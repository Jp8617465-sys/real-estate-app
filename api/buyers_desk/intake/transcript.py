"""Transcripts become speaker turns. One turn is the unit a quote must sit inside.

Formats: .vtt (voice tags or `Name:` cues), .srt, .txt / .md (`Speaker N` turns), and notes with
no speaker labels, whose lines count as the agent's.
"""
import re
from typing import Any

NOTES_SPEAKER = "notes (agent)"
UNKNOWN = "Unknown speaker"


Turn = dict[str, Any]


_VOICE_TAG = re.compile(r"^<v(?:\.[^ >]+)? ([^>]+)>(.*?)(?:</v>)?$", re.S)
_NAME_CUE = re.compile(r"^([^:\n]{1,60}): ([\s\S]*)$")
_SPEAKER_HEADER = re.compile(r"^(Speaker \d+)(?:\s+\(?\d+(?::\d+)+\)?:?)?\s*$")
_TIME = re.compile(r"(\d+):(\d+):(\d+)|(\d+):(\d+)")


def _short_time(stamp: str) -> str:
    """00:00:09,979 or 00:00:09.979 -> 00:09; 1:02:03 stays 1:02:03."""
    stamp = re.split(r"[.,]", stamp.strip())[0]
    return stamp[3:] if stamp.startswith("00:") and stamp.count(":") == 2 else stamp


def _cue_turns(text: str) -> list[Turn]:
    turns: list[Turn] = []
    for block in re.split(r"\n\s*\n", text.replace("\r", "").strip()):
        lines = block.split("\n")
        at = next((i for i, line in enumerate(lines) if "-->" in line), None)
        if at is None:
            continue
        body = "\n".join(lines[at + 1 :]).strip()
        tagged = _VOICE_TAG.match(body)
        named = _NAME_CUE.match(body)
        if tagged:
            speaker, said = tagged.group(1).strip(), tagged.group(2).strip()
        elif named:
            speaker, said = named.group(1).strip(), named.group(2)
        else:
            speaker, said = UNKNOWN, body
        turns.append(
            {"n": len(turns), "time": _short_time(lines[at].split("-->")[0]), "speaker": speaker, "text": said}
        )
    return turns


def _speaker_turns(text: str) -> list[Turn]:
    turns: list[Turn] = []
    current: tuple[str, str] | None = None
    buffer: list[str] = []

    def flush() -> None:
        if current:
            said = "\n".join(buffer).strip()
            if said:
                turns.append({"n": len(turns), "time": current[1], "speaker": current[0], "text": said})

    for line in text.replace("\r", "").split("\n"):
        header = _SPEAKER_HEADER.match(line.strip())
        if header:
            flush()
            stamp = re.search(r"\d+(?::\d+)+", line)
            current, buffer = (header.group(1), stamp.group(0) if stamp else ""), []
        else:
            buffer.append(line)
    flush()
    return turns


def _note_turns(text: str) -> list[Turn]:
    lines = [line.strip() for line in text.replace("\r", "").split("\n") if line.strip()]
    return [{"n": i, "time": "", "speaker": NOTES_SPEAKER, "text": line} for i, line in enumerate(lines)]


def parse(filename: str, text: str, *, notes: bool = False) -> tuple[str, list[Turn]]:
    """Returns ("transcript" | "notes", turns)."""
    if notes:
        return "notes", _note_turns(text)
    name = filename.lower()
    if name.endswith((".vtt", ".srt")) or "-->" in text[:2000]:
        turns = _cue_turns(text)
        if turns:
            return "transcript", turns
    turns = _speaker_turns(text)
    if turns:
        return "transcript", turns
    return "notes", _note_turns(text)
