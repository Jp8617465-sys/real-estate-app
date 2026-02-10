export interface KeyDateInput {
  label: string;
  date: Date;
  isCritical: boolean;
  reminderDaysBefore: number[];
}

export interface ContractDetails {
  exchangeDate: Date;
  settlementDate: Date;
  coolingOffDays?: number;  // varies by state
  financeApprovalDays?: number;  // days from exchange
  buildingPestDays?: number;  // days from exchange for building & pest
  depositDueDays?: number;  // days from exchange
}

export class KeyDatesEngine {
  /**
   * Generate key dates from contract details and state rules.
   */
  static generateKeyDates(contract: ContractDetails, state: string): KeyDateInput[] {
    const dates: KeyDateInput[] = [];

    // 1. Contract signed / exchange
    dates.push({
      label: 'Contract exchanged',
      date: contract.exchangeDate,
      isCritical: true,
      reminderDaysBefore: [1],
    });

    // 2. Cooling-off period expiry (state-specific defaults)
    const coolingOff = contract.coolingOffDays ?? this.getDefaultCoolingOff(state);
    if (coolingOff > 0) {
      dates.push({
        label: 'Cooling-off period expires',
        date: this.addBusinessDays(contract.exchangeDate, coolingOff),
        isCritical: true,
        reminderDaysBefore: [3, 1],
      });
    }

    // 3. Building & pest deadline
    const bpDays = contract.buildingPestDays ?? 14;
    dates.push({
      label: 'Building & pest inspection due',
      date: this.addDays(contract.exchangeDate, bpDays),
      isCritical: true,
      reminderDaysBefore: [7, 3, 1],
    });

    // 4. Finance approval deadline
    const financeDays = contract.financeApprovalDays ?? 21;
    dates.push({
      label: 'Finance approval deadline',
      date: this.addDays(contract.exchangeDate, financeDays),
      isCritical: true,
      reminderDaysBefore: [7, 3, 1],
    });

    // 5. Deposit due
    const depositDays = contract.depositDueDays ?? 5;
    dates.push({
      label: 'Deposit due',
      date: this.addDays(contract.exchangeDate, depositDays),
      isCritical: true,
      reminderDaysBefore: [3, 1],
    });

    // 6. Pre-settlement inspection (typically 1-3 days before settlement)
    dates.push({
      label: 'Pre-settlement inspection',
      date: this.addDays(contract.settlementDate, -2),
      isCritical: true,
      reminderDaysBefore: [7, 3, 1],
    });

    // 7. Settlement day
    dates.push({
      label: 'Settlement',
      date: contract.settlementDate,
      isCritical: true,
      reminderDaysBefore: [14, 7, 3, 1],
    });

    return dates.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Get default cooling-off period by Australian state (in business days).
   */
  static getDefaultCoolingOff(state: string): number {
    const defaults: Record<string, number> = {
      QLD: 5,    // 5 business days
      NSW: 5,    // 5 business days
      VIC: 3,    // 3 business days
      SA: 2,     // 2 business days
      WA: 0,     // No statutory cooling-off
      TAS: 0,    // No statutory cooling-off (but common in contracts)
      ACT: 5,    // 5 business days
      NT: 4,     // 4 business days
    };
    return defaults[state.toUpperCase()] ?? 0;
  }

  /**
   * Determine the status of a key date relative to today.
   */
  static getDateStatus(
    targetDate: Date,
    today: Date = new Date()
  ): 'upcoming' | 'due_soon' | 'overdue' | 'completed' {
    const daysUntil = Math.ceil(
      (targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntil < 0) return 'overdue';
    if (daysUntil <= 3) return 'due_soon';
    return 'upcoming';
  }

  /**
   * Check if reminders should be sent for a date.
   * Returns the reminder level (days before) that triggered, or null.
   */
  static shouldSendReminder(
    targetDate: Date,
    reminderDaysBefore: number[],
    today: Date = new Date()
  ): number | null {
    const daysUntil = Math.ceil(
      (targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Check if today matches any reminder day
    for (const reminderDay of reminderDaysBefore) {
      if (daysUntil === reminderDay) return reminderDay;
    }

    return null;
  }

  // ─── Date Helpers ──────────────────────────────────────────────────

  static addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  static addBusinessDays(date: Date, days: number): Date {
    const result = new Date(date);
    let remaining = days;
    while (remaining > 0) {
      result.setDate(result.getDate() + 1);
      const dayOfWeek = result.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        remaining--;
      }
    }
    return result;
  }
}
