# `upsert` writes only the columns present in the data object

`Sheet.upsert(rows, { key })` writes a column only when that column's header is
an own key of the row object. Any header absent from the object is left exactly
as it is, rather than being blanked or rewritten.

This exists because sheets are frequently half machine-generated and half
human-authored — a sync fills in derived columns while a person types notes
alongside them — and human columns are the only ones that cannot be
regenerated. Making omission mean "leave alone" puts the safe outcome on the
default path: a caller protects a human column by simply not mentioning it,
and every column added to a sheet later is protected automatically, in every
project using the framework, without anyone revisiting the calling code.

## Considered options

The alternative was an explicit allowlist — `upsert(rows, { key, columns })` —
which is more self-documenting at the call site. It was rejected because it
inverts the default: forgetting a column silently destroys data, and it offers
no protection for columns that did not exist when the call was written.

## Consequences

`upsert` cannot be used to clear a column by omitting it; clearing requires
passing the key explicitly with an empty value. This is deliberate — the
ability to blank a cell by forgetting to mention it is the exact failure this
contract prevents.

Because the contract is what callers rely on to keep human data safe, widening
it later (writing every header regardless) would silently corrupt sheets in
every dependent project. Treat it as fixed.

Updates write only the cells that actually changed, grouped into contiguous
column runs, rather than rewriting whole rows. Untouched cells may contain
formulas, and rewriting them with `getValues()` output would replace those
formulas with static values. A sync that finds nothing changed performs no
writes at all.
