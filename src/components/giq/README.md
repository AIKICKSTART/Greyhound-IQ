# GreyhoundIQ Design-System Components

This folder mirrors the component contract from the supplied GreyhoundIQ design-system archive:

- Core: `Badge`, `Button`, `Card`, `Icon`, `IconButton`, `Input`, `Textarea`, `Select`, `Logo`, `StatusPill`, `Tabs`
- Feedback: `Alert`, `Accordion`, `Modal`, `Tooltip`
- Racing: `BOX_COLOURS`, `BoxNumber`, `MeetingCard`, `RunnerRow`

The components reuse the app-wide `giq-*` classes in `src/app/globals.css` and keep the Australian box-rug order isolated in `src/lib/box-colours.ts`.

Use the barrel import for new feature work:

```tsx
import { Button, Card, BoxNumber } from "@/components/giq";
```

Archive audit artifacts are saved in `output/design-system-full-audit/`.
