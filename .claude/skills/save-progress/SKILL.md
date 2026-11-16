---
name: save-progress
description: End-of-session routine - update the progress log and game plan, then save the work with git and push it to GitHub. Use when Sarosh says he's done, wants to save, or at a good stopping point.
---

# Saving progress

## 1. Update the memory files
- Add an entry at the bottom of `docs/progress-log.md`:
  ```
  ## YYYY-MM-DD — <short fun title>
  - **Built:** ...
  - **Learned:** ... (the coding idea of the day, in kid words)
  - **Next:** ...
  ```
- Tick off finished items and add new ideas in `docs/game-plan.md`.

## 2. Save with git
Explain it simply: "Git is like a save point in a video game. If we break something later, we can go back."
```
git add -A
git commit -m "Puck now bounces off the boards"
git push
```
- Commit messages: short, plain English, describing what the game can do now.
- Ask Sarosh before pushing. Never force-push or delete history.
- Don't commit screenshots, temp files, or anything with personal info.

## 3. Wrap up
Tell Sarosh in one or two sentences what he built today and tease the next step. 🏒
