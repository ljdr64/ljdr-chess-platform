import { useEffect } from 'react';
import { startChessboard } from '../../../chessboard/startChessboard';

export default function Play() {
    useEffect(() => {
        startChessboard();
        const IS_DEMO_APP = true;
        if (IS_DEMO_APP) {
            const demoInfo = document.getElementById('demo-info');
            if (demoInfo) demoInfo.style.display = 'block';
        }
    }, []);

    return (
        <>
            <div className="no-js-error" style={{ display: 'none' }}>
                <h1>⚠ JavaScript Error!</h1>
                <span>This app requires JavaScript.</span>
                <br />
                <small>
                    Please enable JavaScript in your browser settings to
                    continue.
                </small>
            </div>

            <div id="demo-info" style={{ display: 'none' }}>
                <b># Demo Info:</b> This project is running on a free hosting
                service. To prevent potential hosting-related performance
                issues, I recommend{' '}
                <a
                    href="https://github.com/bberkay/chess?tab=readme-ov-file#installation"
                    target="_blank"
                >
                    cloning the repository and running it locally
                </a>
                .
            </div>

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
        </>
    );
}
