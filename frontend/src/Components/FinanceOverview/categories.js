// Keep in sync with EXPENSE_CATEGORIES / INCOME_CATEGORIES in server.py

export const EXPENSE_CATEGORIES = [
  'Rent/Mortgage', 'Utilities', 'Groceries', 'Dining Out', 'Transportation',
  'Entertainment', 'Subscriptions', 'Shopping', 'Healthcare', 'Insurance',
  'Debt Payment', 'Education', 'Travel', 'Personal Care', 'Gifts & Donations',
  'Recurring Bills', 'Uncategorized', 'Miscellaneous'
];

export const INCOME_CATEGORIES = [
  'Salary', 'Bonus', 'Freelance/Business', 'Investment Income',
  'Gift Received', 'Refund', 'Uncategorized', 'Other Income'
];

export const CATEGORY_COLORS = {
  'Rent/Mortgage': '#c05621',
  'Utilities': '#b7791f',
  'Groceries': '#2f855a',
  'Dining Out': '#c53030',
  'Transportation': '#2b6cb0',
  'Entertainment': '#805ad5',
  'Subscriptions': '#6b46c1',
  'Shopping': '#d53f8c',
  'Healthcare': '#319795',
  'Insurance': '#2c5282',
  'Debt Payment': '#9b2c2c',
  'Education': '#2b6cb0',
  'Travel': '#dd6b20',
  'Personal Care': '#b83280',
  'Gifts & Donations': '#38a169',
  'Recurring Bills': '#718096',
  'Uncategorized': '#a0aec0',
  'Miscellaneous': '#718096',
  'Salary': '#2f855a',
  'Bonus': '#38a169',
  'Freelance/Business': '#3182ce',
  'Investment Income': '#805ad5',
  'Gift Received': '#d53f8c',
  'Refund': '#319795',
  'Other Income': '#4a5568'
};

export const getCategoryColor = (category) => CATEGORY_COLORS[category] || '#718096';
