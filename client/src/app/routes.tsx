import {
    createBrowserRouter,
    createRoutesFromElements,
    Route,
} from 'react-router-dom';
import PublicLayout from '@ChessPlatform/layouts/PublicLayout';
import Home from '@ChessPlatform/features/home/pages/Home';
import Play from '@ChessPlatform/features/game/pages/Play';

export const router = createBrowserRouter(
    createRoutesFromElements(
        <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/play" element={<Play />} />
        </Route>
    )
);
