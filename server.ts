// Root entry point.
// The actual server implementation lives in api/server.ts.
// This shim keeps `npm run dev` / `npm start` (`tsx server.ts`) and editor
// tooling pointing at a valid file while the implementation stays in api/.
import './api/server';
