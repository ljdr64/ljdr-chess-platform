import { useEffect } from 'react';
import { startChessboard } from '../../../chessboard/startChessboard';

export default function Play() {
    useEffect(() => {
        startChessboard();
    }, []);

    return (
        <main>
            <div className="left">
                <div id="navbar" />
                <div id="log-console" />
                <div id="settings-menu" />
                <div id="appearance-menu" />
                <div id="about-menu" />
            </div>
            <div className="center">
                <div
                    id="black-player-section-mobile-loading-container"
                    className="player-section-mobile-loading-container"
                />
                <div id="board-creator-tablet-loading-container" />
                <div id="chessboard" />
                <div
                    id="white-player-section-mobile-loading-container"
                    className="player-section-mobile-loading-container"
                />
                <div id="navigator-modal" />
                <div id="board-creator" />
            </div>
            <div className="right">
                <div id="notation-menu" />
                <div id="piece-creator" />
                <div id="board-creator-mobile-loading-container" />
            </div>
        </main>
    );
}
