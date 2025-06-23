import {
    createBrowserRouter,
    createRoutesFromElements,
    Route,
} from 'react-router-dom';
import PublicLayout from '@ChessPlatform/layouts/PublicLayout';
import Play from '@ChessPlatform/features/game/pages/Play';

export const router = createBrowserRouter(
    createRoutesFromElements(
        <Route element={<PublicLayout />}>
            <Route path="/" element={<Play />} />
        </Route>
    )
);
