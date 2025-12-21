import { Suspense } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { BrowserRouter } from "react-router-dom";
import { StyleSheetManager } from "styled-components";
import { AuthProvider } from "./context/AuthContext";
import { BoardProvider } from "./context/BoardContext";
import { ProjectProvider } from "./context/ProjectContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
	<Suspense fallback={<div>Loading...</div>}>
		<BrowserRouter>
			<AuthProvider>
				<ProjectProvider>
					<BoardProvider>
						<StyleSheetManager shouldForwardProp={(prop) => prop !== "shake"}>
							<App />
						</StyleSheetManager>
					</BoardProvider>
				</ProjectProvider>
			</AuthProvider>
		</BrowserRouter>
	</Suspense>
);
