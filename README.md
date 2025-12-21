# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type aware lint rules:

- Configure the top-level `parserOptions` property like this:

```js
export default {
  // other rules...
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: ['./tsconfig.json', './tsconfig.node.json'],
    tsconfigRootDir: __dirname,
  },
}
```

- Replace `plugin:@typescript-eslint/recommended` to `plugin:@typescript-eslint/recommended-type-checked` or `plugin:@typescript-eslint/strict-type-checked`
- Optionally add `plugin:@typescript-eslint/stylistic-type-checked`
- Install [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react) and add `plugin:react/recommended` & `plugin:react/jsx-runtime` to the `extends` list

```
React-Task-Management
├─ .eslintrc.cjs
├─ firestore.rules
├─ index.html
├─ package-lock.json
├─ package.json
├─ postcss.config.js
├─ public
│  └─ vite.svg
├─ README.md
├─ src
│  ├─ App.tsx
│  ├─ assets
│  │  ├─ images
│  │  │  ├─ bg.jpg
│  │  │  ├─ Task Flow.png
│  │  │  ├─ task.jpg
│  │  │  ├─ task2.jpg
│  │  │  └─ task3.jpg
│  │  └─ react.svg
│  ├─ components
│  │  ├─ Modals
│  │  │  └─ AddModal.tsx
│  │  ├─ Navbar
│  │  │  └─ index.tsx
│  │  ├─ RequireAuth
│  │  │  └─ index.tsx
│  │  ├─ Sidebar
│  │  │  └─ index.tsx
│  │  └─ Task
│  │     └─ index.tsx
│  ├─ context
│  │  ├─ AuthContext.tsx
│  │  ├─ authContextStore.ts
│  │  ├─ BoardContext.tsx
│  │  ├─ boardContextStore.ts
│  │  ├─ ProjectContext.tsx
│  │  ├─ projectContextStore.ts
│  │  ├─ useAuth.ts
│  │  ├─ useBoards.ts
│  │  └─ useProjects.ts
│  ├─ data
│  │  └─ board.ts
│  ├─ firebase.ts
│  ├─ helpers
│  │  ├─ getRandomColors.ts
│  │  ├─ onDragEnd.ts
│  │  └─ roles.ts
│  ├─ index.css
│  ├─ layout
│  │  └─ index.tsx
│  ├─ main.tsx
│  ├─ pages
│  │  ├─ Analytics
│  │  │  └─ index.tsx
│  │  ├─ Auth
│  │  │  └─ index.tsx
│  │  ├─ Backlog
│  │  │  └─ index.tsx
│  │  ├─ Boards
│  │  │  └─ index.tsx
│  │  ├─ BoardsHub
│  │  │  └─ index.tsx
│  │  ├─ Home
│  │  │  └─ index.tsx
│  │  ├─ Newsletter
│  │  │  └─ index.tsx
│  │  ├─ NotFound
│  │  │  └─ index.tsx
│  │  ├─ Notifications
│  │  │  └─ index.tsx
│  │  ├─ ProjectBoard
│  │  │  └─ index.tsx
│  │  ├─ Projects
│  │  │  └─ index.tsx
│  │  └─ Workflows
│  │     └─ index.tsx
│  ├─ routes
│  │  └─ index.tsx
│  ├─ services
│  │  ├─ automationService.ts
│  │  ├─ boardService.ts
│  │  ├─ collaborationService.ts
│  │  ├─ commentService.ts
│  │  ├─ projectService.ts
│  │  ├─ sprintService.ts
│  │  ├─ taskService.ts
│  │  └─ timeLogService.ts
│  ├─ types
│  │  ├─ automation.ts
│  │  ├─ collaboration.ts
│  │  ├─ index.tsx
│  │  ├─ notifications.ts
│  │  ├─ sprints.ts
│  │  ├─ time.ts
│  │  └─ ui.ts
│  └─ vite-env.d.ts
├─ storage.rules
├─ tailwind.config.js
├─ tsconfig.json
├─ tsconfig.node.json
├─ vite.config.ts
└─ yarn.lock

```