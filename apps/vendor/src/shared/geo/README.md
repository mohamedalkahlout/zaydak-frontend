# `@/shared/geo` — bundled country, region, city and district tables

Reference data for address forms, shipped with the app instead of fetched. A
country dropdown has to render on first paint, work offline, and still be there
when a free public API stops answering, so nothing here is a runtime call.

| File | Rows | Size | Loaded |
|---|---|---|---|
| `countries.json` | 250 | 36KB | eagerly |
| `sa-regions.json` | 13 | 750B | eagerly |
| `sa-cities.json` | 15,513 | 1.1MB | lazy `import()`, only when the address dialog opens on a Saudi shop |
| `sa-districts.json` | 21,235 | 1.6MB | lazy `import()`, only when the district picker mounts (Saudi shops) |

## Where the data came from

**`countries.json`** — trimmed from
[`dr5hn/countries-states-cities-database`](https://github.com/dr5hn/countries-states-cities-database),
kept to `{ code, en, ar, flag, dial, currency, postal?, postalFormat? }`. It is
the only free country set carrying an Arabic name per country
(`translations.ar`). Licensed **ODbL-1.0**, which asks for attribution and for a
publicly conveyed derivative database to be offered under the same terms.
Fields the trim still drops, if they are ever wanted: `timezones`,
`nationality`, `capital`, lat/lng.

Two things the generator has to do, both learned from the data:

- **`ar` falls back through `translations.ar` → `native` → `name`, testing for
  non-whitespace at each step.** Cameroon's Arabic translation is a single
  space, so a plain `or` chain accepted it and left one country with a blank
  label.
- **`postal` keeps only patterns a JS `RegExp` can compile.** The source is
  PCRE; anything with an inline flag such as `(?i)` is dropped at generation
  rather than left to throw inside the address dialog. 189 of 250 countries
  have a usable pattern; `isValidPostalCode` passes everything for the other
  61 rather than blocking an address our table cannot describe.

**`sa-regions.json` / `sa-cities.json` / `sa-districts.json`** — from the
MOMRAH Unified Municipal Coding
([`saudi-municipal-coding`](https://github.com/yasseralsamman/saudi-municipal-coding),
data CC0-1.0): 13 regions, 15,513 cities and 21,235 districts, bilingual, with
stable integer ids, kept to `{ id, en, ar }` plus each row's parent ids. It
replaced a 2022 GPL-2.0 scrape of `maps.address.gov.sa` (4,581 cities, no
districts). Every city has at least one district; for a small settlement the
district is often the settlement itself.

**The English spellings are not all MOMRAH's, on purpose.** The English name
is the stored value (below) and the origin city a carrier receives, and the
dataset's transliterations would have renamed most of Saudi Arabia under the
shops that already picked it — Dammam to "Aldammam", Tabuk to "Tbwk", Taif to
"Alttayif", Makkah region to "Makkah Al Mukarramah". So the switch kept the old
English (and the old Arabic region labels, which say "منطقة") wherever a MOMRAH
city matched an old one one-to-one on region and Arabic name — every major city
did — and took MOMRAH's spelling only for the rest. Two big ones did not match:
MOMRAH has no Hofuf or Mubarraz, only "Al Ahsa", so a shop saved on either keeps
its string and the picker shows it unselected.

## Regenerating

`node scripts/generate-geo.cjs`, from `back-end/`, where `saudi-municipal-coding`
is a dev dependency. **It pins every row's English name to the one the
committed file already gives that id**, so a newer dataset can add places but
never rename one a shop has stored; only a new id takes the dataset's spelling.
All-capitals names are title-cased on the way in. Keep the shapes in `data.ts`
(`Country`, `GeoEntry`, `SaCity`, `SaDistrict`) as the contract, minify on
write, and sort by the English name. The `--legacy` flag was the one-off
transition from the old tables and is not needed again.

The same run writes the back-end's copy of the city and district names,
`back-end/src/geo/sa-place-names.data.json` (`[id, region, en, ar]` per city,
`[city, en, ar]` per district): the chat looks a National Address the carrier
resolved in English up in it, for the Arabic names a customer reading Arabic is
shown. Commit both together, so the two never disagree on a spelling.

## What is stored

`ShopLocation.country` holds the **ISO2 code**; `state`, `city` and `district`
hold the **English** name. One string that a carrier or an export reads must not change
meaning when the dashboard is flipped to Arabic, so the Arabic column is a
label, never a value. `resolveCountry` additionally matches a display name, so
rows written before the picker existed still resolve.

Only Saudi Arabia has structured region, city and district pickers, and only
Saudi addresses have a district field at all. The other 249
countries keep free-text inputs — a dropdown that covers them badly is worse
than a field a vendor can fill in.
