# TxLINE Scores Snapshot API: StatusId Stuck at H2 After Match Completion

## Description

The `GET /api/scores/snapshot/{fixtureId}` endpoint fails to update the last
message's `StatusId` to `5` (Finished) after a match has ended. The StatusId
remains at `4` (H2 — Second Half) indefinitely, even though no further score
updates are expected.

## Observed Behavior

- **Fixture ID**: `18179551` (Spain vs Austria, World Cup 2026)
- **Kickoff**: 2026-07-02 15:00 UTC
- **Expected end**: ~2026-07-02 16:45 UTC (90' + stoppage time)
- **Bug detected**: ~2026-07-02 17:45 UTC (1 hour after normal completion)
- **Last StatusId returned**: `4` (H2) — one hour after the match should have
  been marked Finished, the endpoint still returned Second Half status.
- **Scores returned**: Final scores were present in `Score.Participant1.Total.Goals`
  and `Score.Participant2.Total.Goals`, but the status field did not reflect
  the match was over.

## Sample Response (truncated)

```json
{
  "StatusId": 4,
  "Score": {
    "Participant1": { "Total": { "Goals": 2 } },
    "Participant2": { "Total": { "Goals": 1 } }
  },
  "Clock": { "Seconds": 5580 },
  "Ts": 1751480700000
}
```

`StatusId` mapping:
| ID | Meaning  |
|----|----------|
| 1  | Not Started |
| 2  | First Half |
| 3  | Halftime  |
| 4  | Second Half |
| 5  | Finished (expected but missing) |
| …  | …         |
| 10 | Finished after Extra Time |
| 13 | Finished after Penalties |

## Impact on Consumers

Applications that rely on `StatusId` to determine match completion will not
detect the end of play. Downstream effects include:

1. **Settlement/auto-payout systems** cannot trigger because the data source
   never signals termination.
2. **Live-score UIs** continue showing the match as in-progress.
3. **Caching layers** that key on `StatusId` may never invalidate stale state.
4. **Webhook/subscription-based integrations** that watch for `StatusId == 5`
   will silently wait forever.

## Suspected Root Causes

### 1. Missing transition event in the ingestion pipeline
The data feed that produces status transitions may have skipped or dropped the
"match ended" event for this fixture. This could be caused by:
- A race condition in the feed parser when the final whistle event and the
  full-time score arrive near-simultaneously.
- A timeout or disconnect during the final moments of the match that was never
  replayed.
- The event being emitted but not persisted to the snapshot store.

### 2. Snapshot not refreshed after final state change
The snapshot endpoint may be returning a cached response that was captured
before the final status transition. If the snapshot is updated on a timer
rather than on every event, the final update window may have been missed.

### 3. StatusId derived from a stale message
If the snapshot assembles its output from a message history that includes
amends or corrections, the "highest StatusId" logic may have been applied
incorrectly, or a post-match amend (e.g., a stat correction) may have
regressed the displayed StatusId to an earlier value.

## Reproduction Steps

```bash
# Replace {FIXTURE_ID} with a recently finished fixture
curl -s "https://txline-dev.txodds.com/api/scores/snapshot/{FIXTURE_ID}" \
  -H "Authorization: Bearer ${JWT}" \
  -H "X-Api-Token: ${API_TOKEN}" | jq '.[-1].StatusId'
```

Expected output: `5`, `10`, or `13`
Observed output: `4`

## Suggested Investigation

1. **Check the scores stream replay** — Fetch
   `GET /api/scores/updates/{fixtureId}` or the historical endpoint to see
   whether a `StatusId == 5` message was ever produced for this fixture.
2. **Compare the snapshot timestamp** — The `Ts` of the snapshot vs the
   actual match end time. If the snapshot is significantly older, the refresh
   cycle is the culprit.
3. **Audit the feed source** — Confirm the third-party stats provider sent
   the full-time status event.
4. **Test with a known-finished fixture** — Query several older finished
   fixtures to see whether this is an isolated incident or a systemic gap.

## Environment

- **API Base URL**: `https://txline-dev.txodds.com`
- **Endpoint**: `GET /api/scores/snapshot/{fixtureId}`
- **Fixture**: `18179551`, `CompetitionId: 72` (World Cup 2026)
- **Sport**: Soccer (Association Football)
- **Date observed**: 2026-07-02
