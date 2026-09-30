"""Valid ICAO-style MRZ helpers for tests and demos."""

# Classic ICAO Doc 9303 example (expired — fine for parser unit tests)
SAMPLE_MRZ_ICAO = (
    "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\n"
    "L898902C36UTO7408122F1204159ZE184226B<<<<<10"
)

# Same identity with a future expiry (usable in check-in validation)
SAMPLE_MRZ = (
    "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\n"
    "L898902C36UTO7408122F3212312ZE184226B<<<<<18"
)
