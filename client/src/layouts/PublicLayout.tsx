import { Outlet } from 'react-router-dom';
import Navbar from '@ChessPlatform/components/Navbar';

export default function PublicLayout() {
    return (
        <>
            <Navbar />
            <main className="p-2">
                <Outlet />
            </main>
        </>
    );
}
