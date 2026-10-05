# t3-mods

Claude Code plugins draw UI: status lines, toasts, and a band above the prompt. The
[T3 Code](https://github.com/pingdotgg/t3code) desktop app runs Claude headless and drops all of
it. t3-mods patches your installed T3 Code so it draws that UI for any plugin, and re-applies the
patch after each T3 update.

macOS only. Unofficial; the T3 Code team doesn't support it.

## Set it up with a coding agent

Give your agent this repo and say:

> Set up t3-mods from this repo by following AGENTS.md.

[AGENTS.md](AGENTS.md) walks the agent through the checks, the install, and the verification.

## Set it up by hand

You need Node.js 24 or newer, git (`xcode-select --install`), and T3 Code in `/Applications`.

```sh
git clone https://github.com/codeclawd/t3-mods.git ~/t3-mods
~/t3-mods/bin/t3-mods install          # Nightly; add --app "/Applications/T3 Code (Alpha).app" for another build
~/t3-mods/bin/t3-mods apply            # quits T3, patches, reopens it; don't reopen it yourself
```

The first install clones T3 Code and builds it, which takes a few minutes. It also creates a
self-signed code-signing key ("t3-mods code signing") in your login keychain. If it prints a
`security set-key-partition-list` command, run that once in Terminal (it asks for your Mac
password), then run `t3-mods sign-setup`. When T3 reopens, macOS asks once to let T3 read its
keychain item and your folders. Click **Allow**; with the key in place, those answers stick.

## Commands

| Command | What it does |
|---|---|
| `t3-mods install [--app PATH] [--no-agent]` | Checks requirements, writes `~/.t3-mods/config.env`, builds the patch, installs the agent |
| `t3-mods apply [SECONDS]` | Quits T3 Code, patches it and reopens it |
| `t3-mods status` | Shows the T3 version, patch state, agent state and recent log lines |
| `t3-mods restore` | Puts back the official app and pauses patching (`apply` resumes) |
| `t3-mods uninstall` | Restores the official app and removes the agent |
| `t3-mods sign-setup` | Checks the signing key after its one-time approval |

## Which plugins work

Any Claude Code plugin that calls `$.ui.status`, `$.ui.toast`, or hooks `ui.render` on
`AbovePrompt`. T3 draws them the way Claude Code Desktop does: one status line per plugin, toasts
through T3's own notifications, and every plugin's band stacked in the order the engine chains
them. Text, colours, boxes, buttons, links and block-character art render. Panes, text fields,
selects and custom `Client` modules don't render yet.

The band appears once the thread's first prompt starts its Claude session.

## Add your own T3 patches

The T3 change ships in this repo as `patches/claude-plugin-ui.patch`, so you don't need a fork of
T3. `T3_PATCHES` in `~/.t3-mods/config.env` lists what to apply, in order, on top of the exact T3
release you run. An entry is a `.patch` file (from `git format-patch`, path relative to this repo or
absolute, no spaces) or a git branch written `<git url>#<branch>`:

```sh
T3_PATCHES="patches/claude-plugin-ui.patch /Users/you/my-fix.patch https://github.com/you/t3code.git#another-fix"
```

t3-mods applies patch files with a 3-way `git am` and skips a patch the release already contains. It
applies a branch's own commits and skips any T3 has merged. If something stops applying to a new
T3 release, you get a notification and T3 runs unpatched until you update that patch.

## How it works

1. A launchd agent (`com.t3-mods.agent`) runs every 15 seconds and whenever T3's updater replaces
   the app.
2. For a new T3 version it checks out the matching release tag, applies your patches, and
   builds T3's server and web client (about 40 seconds).
3. Once T3 is closed it saves a copy of the official app, points the app's `apps/server/dist` at
   the build by editing the `app.asar` header, and re-signs the app ad hoc.

The re-sign keeps T3's official designated requirement, so T3's updater still accepts official
releases. After an update the agent builds again and tells you to quit T3 once.

## Costs and limits

- **Signing:** t3-mods re-signs T3 with its own key and a requirement that also accepts official
  releases, so T3's updater keeps working and macOS remembers your Allow answers. Without the
  key's one-time approval it falls back to an ad-hoc signature, and macOS asks again on every
  launch.
- **Dropped entitlements:** an ad-hoc signature can't hold T3's Apple-restricted entitlements.
  Passkey sign-in for T3 Connect may fail in a patched app.
- **One build at a time:** state lives in `~/.t3-mods` (clone, build worktree, one official app
  copy, log).

## Troubleshooting

| Symptom | Fix |
|---|---|
| Notification: "macOS blocked t3-mods from updating T3 Code" | System Settings > Privacy & Security > App Management: click +, press Cmd+Shift+G, add `/bin/bash`, then run `t3-mods apply` |
| Notification: patches "don't apply" | A T3 release conflicts with a patch branch. T3 runs unpatched until the branch is rebased |
| T3 doesn't reopen after `apply` | Open it yourself, then check `t3-mods status` and `~/.t3-mods/agent.log` |
| No plugin UI after patching | Send a prompt in a Claude thread; the band starts with the thread's Claude session |

## Files

| Path | Purpose |
|---|---|
| `bin/t3-mods` | The CLI and the agent's entry point |
| `lib/asar-patch.mjs` | Rewrites the asar header so `apps/server/dist` reads from `app.asar.unpacked` |
| `lib/entitlements.plist` | The entitlements the ad-hoc signature keeps |
| `launchd/agent.plist` | Agent template |
| `patches/claude-plugin-ui.patch` | The T3 change that draws plugin UI (two commits, `git format-patch`) |
| `config.example.env` | Default config |

## License

MIT
