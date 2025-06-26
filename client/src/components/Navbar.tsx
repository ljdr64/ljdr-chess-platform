// src/components/Navbar.tsx

import { useState } from 'react';
import {
    FaChess,
    FaSignInAlt,
    FaBars,
    FaTimes,
    FaUserPlus,
} from 'react-icons/fa';
import { Link } from 'react-router-dom';

export default function Navbar() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <nav className="bg-white shadow-md px-6 py-3 sticky top-0 z-50">
            <div className="flex items-center justify-between max-w-7xl mx-auto">
                {/* Logo */}
                <Link
                    to="/"
                    className="flex items-center gap-2 text-xl font-bold text-blue-600"
                >
                    <FaChess size={28} />
                    <span className="hidden sm:inline">LJDR-Chess</span>
                </Link>

                {/* Desktop Nav */}
                <div className="hidden md:flex items-center space-x-6 text-gray-700 font-medium">
                    <Link to="/" className="hover:text-blue-600 transition">
                        Home
                    </Link>
                    <Link to="/play" className="hover:text-blue-600 transition">
                        Play
                    </Link>
                    <Link
                        to="/tournaments"
                        className="hover:text-blue-600 transition"
                    >
                        Tournaments
                    </Link>
                    <Link
                        to="/about"
                        className="hover:text-blue-600 transition"
                    >
                        About
                    </Link>
                </div>

                {/* Desktop Buttons */}
                <div className="space-x-4 hidden md:flex">
                    <Link
                        to="/login"
                        className="flex items-center gap-2 bg-white text-blue-600 font-semibold px-4 py-2 rounded-xl shadow hover:bg-blue-50 transition"
                    >
                        <FaSignInAlt />
                        Login
                    </Link>
                    <Link
                        to="/sing up"
                        className="flex items-center gap-2 bg-blue-200 text-black font-semibold px-4 py-2 rounded-xl shadow hover:bg-blue-300 transition"
                    >
                        <FaUserPlus />
                        Sing Up
                    </Link>
                </div>

                {/* Mobile Menu Icon */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="md:hidden text-gray-600 focus:outline-none"
                >
                    {isOpen ? <FaTimes size={22} /> : <FaBars size={22} />}
                </button>
            </div>

            {/* Mobile Menu */}
            {isOpen && (
                <div className="absolute w-full left-0 px-6 md:hidden mt-3 py-4 space-y-2 border-t-1 border-gray-200 bg-white">
                    <Link to="/" className="block hover:text-blue-600">
                        Home
                    </Link>
                    <Link to="/play" className="block hover:text-blue-600">
                        Play
                    </Link>
                    <Link
                        to="/tournaments"
                        className="block hover:text-blue-600"
                    >
                        Tournaments
                    </Link>
                    <Link to="/about" className="block hover:text-blue-600">
                        About
                    </Link>
                    <hr className="border-t-1 border-gray-200 rounded-xl" />
                    <Link to="/login" className="block hover:text-blue-600">
                        Login
                    </Link>
                    <Link to="/signup" className="block hover:text-blue-600">
                        Sign Up
                    </Link>
                </div>
            )}
        </nav>
    );
}
