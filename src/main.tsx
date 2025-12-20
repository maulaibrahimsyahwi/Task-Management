import { Suspense } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { BrowserRouter } from "react-router-dom";
import { StyleSheetManager } from "styled-components";
import { AuthProvider } from "./context/AuthContext";
import { BoardProvider } from "./context/BoardContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
	<Suspense fallback={<div>Loading...</div>}>
		<BrowserRouter>
			<AuthProvider>
				<BoardProvider>
					<StyleSheetManager shouldForwardProp={(prop) => prop !== "shake"}>
						<App />
					</StyleSheetManager>
				</BoardProvider>
			</AuthProvider>
		</BrowserRouter>
	</Suspense>
);
