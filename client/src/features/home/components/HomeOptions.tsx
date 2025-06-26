import { Link } from 'react-router-dom';

const timeControls = [
    '1+0',
    '2+0',
    '2+1',
    '3+0',
    '3+2',
    '5+0',
    '10+0',
    '10+5',
    '15+10',
];

export default function HomeOptions() {
    return (
        <div className="max-w-3xl mx-auto sm:px-4 py-10 min-w-[21rem] min-h-[21rem]">
            <h1 className="text-3xl font-bold text-center mb-10">
                Jugar una partida
            </h1>
            <div className="grid grid-cols-3 sm:gap-2 mb-2">
                {timeControls.map((tc) => (
                    <Link
                        key={tc}
                        to={`/lobby/${tc.replace('+', '-')}`}
                        className="flex aspect-square w-[7rem] h-[7rem] sm:w-[9rem] sm:h-[9rem] md:w-[10rem] md:h-[10rem] items-center justify-center text-3xl sm:text-4xl font-medium bg-white border border-gray-300 shadow-md rounded-lg sm:rounded-xl hover:bg-blue-100 transition"
                    >
                        {tc}
                    </Link>
                ))}
            </div>
            <div className="flex flex-col justify-center gap-2 mb-10">
                <Link
                    to="/play-vs-friend"
                    className="px-6 py-3 text-xl text-center sm:text-2xl font-medium bg-white border border-gray-300 shadow-md rounded-lg sm:rounded-xl hover:bg-blue-100 transition"
                >
                    Jugar contra un amigo
                </Link>
                <Link
                    to="/play-vs-computer"
                    className="px-6 py-3 text-xl text-center sm:text-2xl font-medium bg-white border border-gray-300 shadow-md rounded-lg sm:rounded-xl hover:bg-blue-100 transition"
                >
                    Jugar contra el ordenador
                </Link>
            </div>
        </div>
    );
}
