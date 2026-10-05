# Setting up t3-mods (instructions for coding agents)

You are installing t3-mods on the user's Mac. It patches their T3 Code desktop app so Claude Code
plugin UI shows up, and keeps the patch across T3 updates. Follow these steps in order. Stop and
report to the user if a check fails; don't work around a failed check.

## 1. Check requirements

Run each command and confirm the expected result.

| Check | Command | Expect |
|---|---|---|
| macOS | `uname -s` | `Darwin` |
| Node.js 24+ | `node -v` | `v24` or higher. If lower, tell the user; don't upgrade Node for them |
| git | `git --version` | a version. If missing, the user runs `xcode-select --install` |
| T3 Code installed | `ls -d /Applications/T3\ Code*.app` | at least one app |

If several T3 Code apps exist, ask the user which one they use. The default is
`/Applications/T3 Code (Nightly).app`.

## 2. Install

From the repo root:

```sh
bin/t3-mods install                              # default app
bin/t3-mods install --app "/Applications/T3 Code (Alpha).app"   # another app
```

The first run clones T3 Code (a few hundred MB) and builds it, which takes a few minutes. Wait for it
to finish. Success ends with `Agent installed (com.t3-mods.agent)`.

If the output includes a `security set-key-partition-list` command, give it to the user to run
in their own Terminal (it asks for their Mac login password; never ask for the password
yourself). After they run it, run `bin/t3-mods sign-setup` and expect `Signing key ready`.
Don't run `codesign` yourself before that: macOS would ask once per signed file.

If it fails, read `~/.t3-mods/agent.log`, `~/.t3-mods/last-install.log` and
`~/.t3-mods/last-build.log`, then report the error to the user.

## 3. Apply

T3 must restart to load the patch. You are probably running inside T3, so restarting it ends your
session. Before you run the command, tell the user:

> T3 Code will close and reopen by itself in about 30 seconds. Don't reopen it yourself. When macOS
> asks for your password to read T3's keychain item, click Always Allow.

Then run:

```sh
bin/t3-mods apply 20
```

The agent waits 20 seconds, so your message reaches the user first.

## 4. Verify

After T3 reopens (the user may need to send you a message to wake you), run:

```sh
bin/t3-mods status
```

Expect `state: patched (...)` and `agent: loaded`. Then ask the user to send a prompt in a thread
that uses Claude. Plugin UI appears once that thread's Claude session starts. If the user has no
UI-drawing Claude Code plugin installed, nothing visible changes; tell them so.

If `status` shows `state: official` and `~/.t3-mods/agent.log` says "macOS refused to write", tell
the user to open System Settings > Privacy & Security > App Management, click +, press Cmd+Shift+G,
add `/bin/bash`, and then run `bin/t3-mods apply 20` again.

## Undo

```sh
bin/t3-mods restore      # official app back, patching paused
bin/t3-mods uninstall    # official app back, agent removed
```

Both restart T3 the same way `apply` does. Warn the user first.

## Rules

- Don't edit files inside the T3 Code app yourself. Use the CLI.
- Don't re-sign T3 Code with any other identity or flags; the updater depends on the requirement
  `t3-mods` keeps.
- Don't add or change `T3_PATCHES` in `~/.t3-mods/config.env` unless the user asks.
