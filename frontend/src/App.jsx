import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SocketProvider } from "./context/SocketContext";
import { LobbyProvider } from "./context/LobbyContext";
import { Home } from "./pages/Home";
import { Game } from "./pages/Game";
import { LobbyRoom } from "./pages/LobbyRoom";
import ErrorBoundary from "./components/ErrorBoundary";

function App() {
	return (
		<BrowserRouter>
			<SocketProvider>
				<LobbyProvider>
					<ErrorBoundary>
						<Routes>
							<Route path="/" element={<Home />} />
							<Route path="/lobby/:lobbyId" element={<LobbyRoom />} />
							<Route path="/game/:lobbyId" element={<Game />} />
						</Routes>
					</ErrorBoundary>
				</LobbyProvider>
			</SocketProvider>
		</BrowserRouter>
	);
}

export default App;
