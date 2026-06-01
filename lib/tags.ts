export const TAG_LABELS: Record<string, string> = {
  clean:          'Clean',
  dirty:          'Dirty',
  has_tp:         'Has TP',
  no_tp:          'No TP',
  has_soap:       'Has Soap',
  no_soap:        'No Soap',
  public:         'Public',
  customers_only: 'Customers Only',
  key_required:   'Key Required',
  changing_table: 'Changing Table',
  accessible:     'Accessible',
}

export const NEGATIVE_TAGS = new Set([
  'dirty',
  'no_tp',
  'no_soap',
  'customers_only',
  'key_required',
])
