export const STEPS = [
  [
    "Analyze and journalize transactions",
    "Turn business events into dated debit-and-credit entries.",
    "A service performed on account increases Accounts Receivable (debit) and Fees Earned (credit). The journal preserves what happened.",
    "The journal becomes the source for ledger posting.",
  ],
  [
    "Post transactions to the ledger",
    "Group activity by account so each account has a running balance.",
    "Posting the service entry increases the receivable and revenue balances in their separate accounts.",
    "Those ledger balances feed the unadjusted trial balance.",
  ],
  [
    "Prepare an unadjusted trial balance",
    "List ledger balances and compare total debits with total credits.",
    "Equal totals catch some posting errors, but do not prove that every event was recorded or used the right accounts.",
    "This is the starting point for finding period-end updates.",
  ],
  [
    "Analyze adjustment data",
    "Identify amounts earned, incurred, used, or expired that are missing from the books.",
    "Supplies of $500 in the ledger and $200 on hand mean $300 was used. The count tells you what remains; the difference is the expense.",
    "Work out the required changes before recording them.",
  ],
  [
    "Prepare an optional worksheet",
    "Organize unadjusted balances, proposed adjustments, adjusted balances, and statement columns.",
    "A worksheet is a working paper, not the journal or ledger. Its adjustments still need to be journalized and posted.",
    "It can help plan steps 6–8, but omitting the worksheet does not omit those steps.",
  ],
  [
    "Journalize and post adjusting entries",
    "Update the ledger for the period’s earned revenue and incurred expenses.",
    "Debit Supplies Expense $300; credit Supplies $300. The remaining Supplies asset is now $200. Routine adjustments here do not move cash.",
    "The updated ledger is ready for a new trial balance.",
  ],
  [
    "Prepare an adjusted trial balance",
    "List every nonzero ledger balance after adjustments and before closing.",
    "Revenue, expenses, and Dividends are still present. Retained Earnings is still its beginning balance in these cases.",
    "Use these amounts to prepare financial statements.",
  ],
  [
    "Prepare financial statements",
    "Explain performance, the change in owners’ equity, and financial position.",
    "Income statement → net income/loss. Equity statement → ending Retained Earnings and Common Stock. Classified balance sheet → assets = liabilities + ending equity.",
    "Prepare statements before clearing temporary accounts. A complete reporting set also includes cash flows; this practice focuses on the three statements in this assignment.",
  ],
  [
    "Journalize and post closing entries",
    "Reset temporary accounts and move the period’s results into Retained Earnings.",
    "Close revenues, expenses, and Dividends. With Income Summary, revenue and expenses pass through a clearing account first. Permanent accounts stay open.",
    "The ledger now carries only permanent balances into the next period.",
  ],
  [
    "Prepare a post-closing trial balance",
    "Verify debit-credit equality after closing and check that temporary accounts are zero.",
    "Cash, receivables, contra assets, liabilities, Common Stock, and ending Retained Earnings remain. Revenues, expenses, Dividends, and Income Summary are omitted.",
    "These become next period’s opening balances. The accounting cycle begins again.",
  ],
];
export const GUIDE = [
  [
    "Adjusting ≠ closing",
    "Adjusting entries make the current period accurate. Closing entries reset the period’s measuring accounts. Record missing wages before statements; zero Wages Expense after statements.",
  ],
  [
    "Temporary ≠ unimportant",
    "Revenue and expense accounts measure one period. Dividends track this period’s distributions. They reset, while their effect survives in Retained Earnings. Income Summary is a temporary clearing account, not a financial statement account.",
  ],
  [
    "Permanent ≠ never changes",
    "Assets, contra assets, liabilities, Common Stock, and Retained Earnings carry forward. They can change throughout the year; “permanent” only means they are not reset during closing. Unearned Fees is a liability, even though its name includes “fees.”",
  ],
  [
    "Retained Earnings has two moments",
    "On the adjusted trial balance, it is the beginning ledger balance in these exercises. On the equity statement and balance sheet, calculate beginning balance + net income (or − net loss) − dividends. Closing makes the ledger agree with that ending amount.",
  ],
  [
    "Classify by what an account means",
    "Current assets will be used or converted to cash within one year or the operating cycle, whichever is longer. Property, plant & equipment is used over longer periods, shown at cost less accumulated depreciation. Separate current obligations from long-term debt, then present stockholders’ equity.",
  ],
  [
    "Debits and credits are directions",
    "Assets, expenses, and Dividends normally increase with debits. Liabilities, Common Stock, Retained Earnings, revenues, and contra assets normally increase with credits. To close an account, use the opposite side of its actual balance. A retained earnings deficit can have a debit balance.",
  ],
];
