# State-First Land Unit Catalogue Research

## Evidence handling rule

An official land-record portal confirms the responsible government authority and supports the existing in-app directory, but it does **not** by itself establish a universal local-unit conversion. A local unit is added only when its square-metre reference is traceable to a credible source and scoped in the converter to the appropriate state/district system.

## Reviewed portal context

The Bihar Revenue and Land Reforms Department public site was reached at `state.bihar.gov.in/lrc/CitizenHome.html`. The Rajasthan Government Revenue Board's Apna Khata portal was reached at `apnakhata.rajasthan.gov.in`; it exposes district, tehsil, and village navigation and identifies its Jamabandi information as general information rather than a certified copy. Neither viewed landing page supplied a statewide or district-specific Bigha/Katha/Dhur/Gaj conversion table, so neither landing page alone is treated as a conversion source.

## Initial catalogue direction

The application will list every Indian state and Union Territory in a state-first selector. Standard acre, hectare, square feet, and square metres remain available for every selection. A state with no defensible local-unit value will show a transparent “standard units only / district verification needed” state rather than a guessed Bigha, Katha, Dhur, Biswa, Guntha, Kanal, Marla, Cent, Ground, or regional equivalent.

## Implemented catalogue boundary

The state selector contains all 28 States and 8 Union Territories. Each selection begins on a standard-units-only profile. Bihar, Uttar Pradesh, Madhya Pradesh, and Rajasthan expose an additional expressly selected Bigha reference profile, not a state-wide default. Bihar's reference additionally exposes Katha and Dhur; UP, MP, and Rajasthan intentionally expose Bigha only because the reviewed evidence did not justify a universal Katha/Dhur value for those states. Each local profile says that district/tehsil revenue convention must confirm it before use.

The Department of Land Resources describes land administration and management as a State List domain and expressly notes variation across language, culture, regions, topography, and nomenclature. This supports a state-first interface with a district-confirmation boundary rather than a fabricated India-wide local-unit value. [1]

## References

[1] [Department of Land Resources, Government of India — DILRMP](https://dolr.gov.in/en/programmes-schemes/dilrmp-2/)
