"""Paging for list endpoints: `limit` (1 to 200, default 50) and `offset`; the total count is in the
`X-Total-Count` header. Prototype scale: the full match is counted, then sliced."""
from dataclasses import dataclass
from typing import Annotated, TypeVar

from fastapi import Depends, Query, Response

T = TypeVar("T")


@dataclass(frozen=True)
class Page:
    limit: int
    offset: int


def page_params(limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)) -> Page:
    return Page(limit, offset)


PageDep = Annotated[Page, Depends(page_params)]


def paginate(items: list[T], response: Response, page: Page) -> list[T]:
    response.headers["X-Total-Count"] = str(len(items))
    return items[page.offset : page.offset + page.limit]
