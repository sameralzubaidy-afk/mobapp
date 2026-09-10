# TradeFlowV2 Automated Run — 2026-09-10T14:56:27.440Z

**Module:** MODULE-15.1.2 TradeFlowV2
**Source:** cross-checked-and-consolidated/MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md

## Summary

| Metric | Count |
|---|---|
| Cases selected | 5 |
| ✅ Passed | 0 |
| ❌ Failed | 5 |
| ⏭️ Skipped (pending/manual) | 0 |
| Execution units run | 2 |

## ❌ Failures (investigate before manual QA)

### TRD-TC-D01, TRD-TC-D02, TRD-TC-D03, TRD-TC-D04, TRD-TC-D05 — maestro (android)
- Asset: `module-15.1.2-flow-08-trade-v2-components.yaml`
- Command: `maestro test --platform android --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/module-15.1.2-flow-08-trade-v2-components.yaml`
- Duration: 130.2s · Attempts: 2
```
Maestro Android driver did not start up in time  ---  emulator [ emulator-5554 ] & port  [ dadb.open( tcp:61575 ) ]

The stack trace was:
maestro.MaestroDriverStartupException$AndroidDriverTimeoutException: Maestro Android driver did not start up in time  ---  emulator [ emulator-5554 ] & port  [ dadb.open( tcp:61575 ) ]
	at maestro.drivers.AndroidDriver.awaitLaunch(AndroidDriver.kt:162)
	at maestro.drivers.AndroidDriver.open(AndroidDriver.kt:108)
	at maestro.Maestro$Companion.android(Maestro.kt:690)
	at maestro.cli.session.MaestroSessionManager.createAndroid(MaestroSessionManager.kt:350)
	at maestro.cli.session.MaestroSessionManager.createMaestro(MaestroSessionManager.kt:211)
	at maestro.cli.session.MaestroSessionManager.newSession(MaestroSessionManager.kt:109)
	at maestro.cli.session.MaestroSessionManager.newSession$default(MaestroSessionManager.kt:67)
	at maestro.cli.command.TestCommand.runShardSuite(TestCommand.kt:479)
	at maestro.cli.command.TestCommand.access$runShardSuite(TestCommand.kt:81)
	at maestro.cli.command.TestCommand$handleSessions$1$results$1$1.invokeSuspend(TestCommand.kt:438)
	at kotlin.coroutines.jvm.internal.BaseContinuationImpl.resumeWith(ContinuationImpl.kt:34)
	at kotlinx.coroutines.DispatchedTask.run(DispatchedTask.kt:100)
	at kotlinx.coroutines.internal.LimitedDispatcher$Worker.run(LimitedDispatcher.kt:124)
	at kotlinx.coroutines.scheduling.TaskImpl.run(Tasks.kt:89)
	at kotlinx.coroutines.scheduling.CoroutineScheduler.runSafely(CoroutineScheduler.kt:586)
	at kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.executeTask(CoroutineScheduler.kt:820)
	at kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.runWorker(CoroutineScheduler.kt:717)
	at kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.run(CoroutineScheduler.kt:704)


```

## ❌ Challenges & Recommendations

### Failure Pattern Analysis

| Pattern | Count | % of Failures |
|---|---|---|
| ❓ Other | 1 | 100% |

### Duration & Performance

- Total execution time: 8.1 min
- Average per unit: 241.7s
- Slowest passing unit: 5.9m 53s
- Slowest failing unit: 2.2m 10s

### Failure Details

#### TRD-TC-D01, TRD-TC-D02, TRD-TC-D03, TRD-TC-D04, TRD-TC-D05 — module-15.1.2-flow-08-trade-v2-components.yaml (android)
- **Root cause:** 🌐 Network issue — backend or admin portal unreachable
- **Duration:** 130.2s · **Attempts:** 2
- **Command:** `maestro test --platform android --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/module-15.1.2-flow-08-trade-v2-components.yaml`

### Recommendations for Future Enhancements

| # | Recommendation | Priority |
|---|---|---|
| 5 | Consider adding a pre-run data integrity check to verify seeded data exists before starting. | Medium |
| 6 | If flakiness persists, implement per-case retry with exponential backoff in the orchestrator. | Low |
| 7 | Review screenshots in `screenshots/` folder to visually confirm UI state at failure point. | Low |

