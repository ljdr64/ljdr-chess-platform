import { Store, StoreKey } from '@ChessPlatform/chessboard/Services/Store';
import { SocketOperation } from '../../Types';
import { BoardEditorOperation, NavigatorModalOperation } from '../Types';
import { Component } from './Component';
import { Chess } from '@ChessPlatform/chessboard/Chess/Chess';
import {
    ChessEvent,
    Color,
    Duration,
    GameStatus,
} from '@ChessPlatform/chessboard/Chess/Types';
import {
    BotAttributes,
    BotColor,
    BotDifficulty,
} from '@ChessPlatform/chessboard/Chess/Bot';
import {
    DEFULT_PLAYER_NAME,
    MAX_PLAYER_NAME_LENGTH,
    MIN_PLAYER_NAME_LENGTH,
    DEFAULT_TOTAL_TIME,
    MAX_TOTAL_TIME,
    MIN_TOTAL_TIME,
    DEFAULT_INCREMENT_TIME,
    MAX_INCREMENT_TIME,
    MIN_INCREMENT_TIME,
    NAVIGATOR_MODAL_ID,
    PIECE_CREATOR_ID,
} from '@ChessPlatform/chessboard/Platform/Consts';
import { REPOSITORY_URL } from '@ChessPlatform/chessboard/Consts';

/**
 * This class provide a menu to show the logs.
 */
export class NavigatorModal extends Component {
    protected modalTitle: string = '';
    protected modalContent: string = '';
    protected modalCloseable: boolean = false;
    protected modalBackdrop: boolean = true;
    protected modalHidden: boolean = false;
    public readonly id: string = NAVIGATOR_MODAL_ID;
    private readonly chess: Chess;

    private readonly _boundCloseModalOnOutsideClick: (
        event: MouseEvent
    ) => void = this.closeModalOnOutsideClick.bind(this);
    private readonly _rootComputedStyle: CSSStyleDeclaration = getComputedStyle(
        document.documentElement
    );

    private lastNavigatorModalTitle: string = '';
    private lastNavigatorModalContent: string = '';

    private lastEnteredPlayerName: string = DEFULT_PLAYER_NAME;
    private lastSelectedBotDifficulty: BotDifficulty = BotDifficulty.Easy;
    private lastSelectedBotColor: BotColor = BotColor.Black;
    private lastSelectedDuration: Duration = {
        remaining: DEFAULT_TOTAL_TIME,
        increment: DEFAULT_INCREMENT_TIME,
    };

    /**
     * Constructor of the NavigatorModal class.
     */
    constructor(chess: Chess) {
        super();
        this.chess = chess;
        this.addEventListeners();
    }

    /**
     * This function adds event listeners that are related to the navigator modal.
     */
    private addEventListeners(): void {
        document.addEventListener(ChessEvent.onGameCreated, (() => {
            if (document.getElementById(PIECE_CREATOR_ID)!.innerHTML === '') {
                const gameStatus = this.chess.getGameStatus();
                if (gameStatus === GameStatus.NotReady)
                    this.showBoardNotReady();
            }
        }) as EventListener);

        document.addEventListener(ChessEvent.onGameOver, (() => {
            if (document.getElementById(PIECE_CREATOR_ID)!.innerHTML === '') {
                const gameStatus = this.chess.getGameStatus();
                if (
                    [
                        GameStatus.BlackVictory,
                        GameStatus.WhiteVictory,
                        GameStatus.Draw,
                    ].includes(gameStatus)
                )
                    this.showGameOver(gameStatus);
            }
        }) as EventListener);
    }

    /**
     * This function renders the navigator modal.
     */
    public renderComponent(
        title: string,
        content: string,
        closeable: boolean = false,
        backdrop: boolean = true,
        hidden: boolean = false
    ): void {
        this.modalTitle = title;
        this.modalContent = content;
        this.modalCloseable = closeable;
        this.modalBackdrop = backdrop;
        this.modalHidden = hidden;

        this.loadHTML(
            NAVIGATOR_MODAL_ID,
            `
            <div class="navigator-modal ${
                backdrop ? 'navigator-modal--glass' : 'navigator-modal--board'
            } ${closeable ? 'closeable' : ''} ${hidden ? 'hidden' : ''}">
                <div class="navigator-modal-bg"></div>
                <div class="navigator-modal-title">${title}</div>
                <div class="navigator-modal-content">${content}</div>
            </div>
        `
        );
        this.loadCSS('navigator-modal.css');
    }

    /**
     * Add the backdrop to the modal.
     */
    private showModalBackdrop(): void {
        if (document.querySelector('.navigator-modal-backdrop')) return;

        const modalBgLayer = document.createElement('div');
        modalBgLayer.classList.add('navigator-modal-backdrop');
        document.body.appendChild(modalBgLayer);
        modalBgLayer.classList.add('show');
    }

    /**
     * Remove the backdrop from the modal.
     */
    private hideModalBackdrop(): void {
        const modalBgLayer = document.querySelector(
            '.navigator-modal-backdrop'
        );
        if (modalBgLayer) modalBgLayer.remove();
    }

    /**
     * Show the modal with the given title and content.
     */
    private show(
        title: string,
        content: string,
        closeable: boolean = false,
        backdrop: boolean = true
    ): void {
        this.hide();
        window.scrollTo(0, 0);

        this.renderComponent(title, content, closeable, backdrop, !backdrop);

        const modal = document.querySelector(
            '.navigator-modal'
        )! as HTMLElement;

        if (backdrop) {
            this.showModalBackdrop();
        } else {
            // Center the modal on the chessboard if the backdrop is not shown.
            // If the backdrop is not shown, the modal will be rendered as hidden.
            // after the centering, show the modal.
            const chessboard = document.getElementById(
                'chessboard'
            ) as HTMLElement;

            const modalWidth = parseInt(
                this._rootComputedStyle.getPropertyValue(
                    '--navigator-modal-board-modal-width'
                )
            );
            modal.style.left = `${
                chessboard.offsetLeft +
                chessboard.offsetWidth / 2 -
                modalWidth / 2
            }px`;

            const modalHeight = parseInt(
                this._rootComputedStyle.getPropertyValue(
                    '--navigator-modal-board-modal-height'
                )
            );
            modal.style.top = `${
                chessboard.offsetTop +
                chessboard.offsetHeight / 2 -
                modalHeight / 2
            }px`;

            modal.classList.remove('hidden');
        }

        setTimeout(() => {
            document.addEventListener(
                'click',
                this._boundCloseModalOnOutsideClick
            );
        }, 0);

        // For go back to the previous state of the modal.
        if (!modal.querySelector('.navigator-modal-content #confirmation')) {
            this.lastNavigatorModalTitle = title;
            this.lastNavigatorModalContent = content;
        }
    }

    /**
     * Close the modal when the user clicks outside of the active modal.
     */
    private closeModalOnOutsideClick(event: MouseEvent): void {
        const activeModal = document.querySelector(
            '.navigator-modal'
        )! as HTMLElement;
        if (!activeModal) return;

        if (!(event.target as HTMLElement).closest('.navigator-modal')) {
            if (activeModal.classList.contains('closeable')) this.hide();
        }
    }

    /**
     * Go back to the previous state of the modal.
     */
    public undo(): void {
        this.show(this.lastNavigatorModalTitle, this.lastNavigatorModalContent);
    }

    /**
     * Show the game over screen.
     */
    public showGameOver(status: GameStatus): void {
        const gameOverMessage = document.querySelector(
            '.navigator-modal .game-over-message'
        );

        this.show(
            status === GameStatus.WhiteVictory
                ? 'White Wins'
                : status === GameStatus.BlackVictory
                ? 'Black Wins'
                : 'Stalemate',
            `
            <span class="game-over-message">${
                gameOverMessage ? gameOverMessage.textContent : ''
            }</span>
            `,
            true,
            false
        );

        if (gameOverMessage) gameOverMessage.textContent = '';
    }

    /**
     * Show the game over screen when one of the players
     * resigned. This is going to modify the content of the
     * game over screen to show the resigned player.
     */
    public showGameOverAsResigned(resignColor: Color): void {
        document.querySelector(
            '.navigator-modal .game-over-message'
        )!.textContent = `
            ${
                resignColor === Color.White ? Color.White : Color.Black
            } has resigned
        `;
    }

    /**
     * Show the game over screen when both players
     * accepted the draw. This is going to modify the
     * content of the game over screen to show the draw
     * accepted message.
     */
    public showGameOverAsDrawAccepted(): void {
        document.querySelector(
            '.navigator-modal .game-over-message'
        )!.textContent = `Draw accepted`;
    }

    /**
     * Show the game over screen when one of the players
     * aborted the game. This is going to modify the content
     * of the game over screen to show the game aborted message.
     */
    public showGameOverAsAborted(): void {
        document.querySelector(
            '.navigator-modal .navigator-modal-title'
        )!.textContent = `Game Aborted`;
        document.querySelector(
            '.navigator-modal .game-over-message'
        )!.textContent = `Player has aborted the game`;
    }

    /**
     * Show the board not ready screen.
     */
    public showBoardNotReady(): void {
        this.show(
            'Not Ready',
            `<span>There might be missing pieces like kings. Please create playable board.</span>
            <div style="text-align:center;margin-top:10px;">
                <button class="" data-menu-operation="${NavigatorModalOperation.Hide}">
                    Ok
                </button>
            </div>`
        );
    }

    /**
     * Show the game creator.
     */
    public showGameCreator(): void {
        this.show(
            'Create New Game',
            `
            <div class = "btn-group-vertical">
                <button data-menu-operation="${NavigatorModalOperation.ShowSelectDuration}">Play against Friend</button>
                <button data-menu-operation="${NavigatorModalOperation.ShowPlayAgainstBot}">Play against Bot</button>
                <button data-menu-operation="${BoardEditorOperation.Enable}">Create Board</button>
            </div>
             <div style="text-align:center;margin-top:10px;">
                <button class="button--text" data-menu-operation="${NavigatorModalOperation.Hide}">
                    Cancel
                </button>
            </div>
            `
        );
    }

    /**
     * Show the play the board screen.
     */
    public showStartPlayingBoard(): void {
        this.show(
            'Start Playing the Board',
            `
            <div class = "btn-group-vertical">
                <button data-menu-operation="${NavigatorModalOperation.ShowSelectDuration}">Play against Friend</button>
                <button data-menu-operation="${NavigatorModalOperation.ShowPlayAgainstBot}">Play against Bot</button>
                <button data-menu-operation="${NavigatorModalOperation.PlayByYourself}">Play by Yourself</button>
            </div>
             <div style="text-align:center;margin-top:10px;">
                <button class="button--text" data-menu-operation="${NavigatorModalOperation.Hide}">
                    Cancel
                </button>
            </div>
            `
        );
    }

    /**
     * Show the select game duration screen after
     * the start playing board screen.
     */
    private showSelectDuration(): void {
        this.show(
            'Select Game Duration',
            `<span>Select the total and increment time:</span>
            <div class="btn-group-grid" id="select-duration" style="padding-top:5px;padding-bottom:15px;">
                <button data-selected="false"><span class="total-time">1</span> + <span class="increment-time">0</span></button>
                <button data-selected="false"><span class="total-time">1</span> + <span class="increment-time">1</span></button>
                <button data-selected="false"><span class="total-time">2</span> + <span class="increment-time">1</span></button>
                <button data-selected="false"><span class="total-time">3</span> + <span class="increment-time">0</span></button>
                <button data-selected="false"><span class="total-time">3</span> + <span class="increment-time">2</span></button>
                <button data-selected="false"><span class="total-time">5</span> + <span class="increment-time">0</span></button>
                <button data-selected="false"><span class="total-time">10</span> + <span class="increment-time">0</span></button>
                <button data-selected="false"><span class="total-time">30</span> + <span class="increment-time">0</span></button>
                <button data-menu-operation="${NavigatorModalOperation.ShowSelectDurationCustom}">Custom</button>
            </div>
            <button type="submit" data-menu-operation="${NavigatorModalOperation.ShowCreateLobby}">Next</button>
            <div style="text-align:center;margin-top:10px;">
                <button class="button--text" data-menu-operation="${NavigatorModalOperation.Hide}">
                    Cancel
                </button>
            </div>
            `
        );
    }

    /**
     * Show the select custom duration screen
     * if the user selects the custom duration
     * on the select duration screen.
     */
    private showSelectDurationCustom(): void {
        this.show(
            'Enter Game Duration',
            `<span>Enter the total and increment time:</span>
            <div class="btn-group-horizontal" style="padding-top:5px;padding-bottom:15px;justify-content:center;">
                <input type="number" id="total-time" placeholder="Min" min="${
                    MIN_TOTAL_TIME / 60000
                }" max="${MAX_TOTAL_TIME / 60000}" required>
                <span style="font-size:var(--navigator-modal-content-duration-separator-font-size);padding:0 10px;">+</span>
                <input type="number" id="increment-time" placeholder="Sec" value="${
                    MIN_INCREMENT_TIME / 1000
                }" min="${MIN_INCREMENT_TIME / 1000}" max="${
                MAX_INCREMENT_TIME / 1000
            }" required>
            </div>
            <button type="submit" data-menu-operation="${
                NavigatorModalOperation.ShowCreateLobby
            }">Next</button>
            <div style="text-align:center;margin-top:10px;">
                <button class="button--text" data-menu-operation="${
                    NavigatorModalOperation.ShowSelectDuration
                }">
                    Back
                </button>
            </div>
            `
        );
    }

    /**
     * Get the selected game duration from the
     * modal. If the select duration modal is open.
     *
     * @returns Must be between MIN_TOTAL_TIME and MAX_TOTAL_TIME
     * minutes for total time and MIN_INCREMENT_TIME and MAX_INCREMENT_TIME
     * seconds for increment time. If not, it will be DEFAULT_TOTAL_TIME
     * and DEFAULT_INCREMENT_TIME.
     */
    private saveSelectedGameDuration(): void {
        /**
         * Convert minutes to milliseconds.
         */
        const minutesToMilliseconds = (minutes: number) => {
            return minutes * 60000;
        };

        /**
         * Convert seconds to milliseconds.
         */
        const secondsToMilliseconds = (seconds: number) => {
            return seconds * 1000;
        };

        const isCustomDurationModalOpen = document.querySelector(
            `[data-menu-operation="${NavigatorModalOperation.ShowSelectDurationCustom}"]
        `
        )
            ? false
            : true;

        let totalTime, incrementTime;
        if (isCustomDurationModalOpen) {
            const totalTimeInput = document.querySelector(
                '.navigator-modal #total-time'
            ) as HTMLInputElement;
            const incrementTimeInput = document.querySelector(
                '.navigator-modal #increment-time'
            ) as HTMLInputElement;
            if (totalTimeInput) totalTime = totalTimeInput.valueAsNumber;
            if (incrementTimeInput)
                incrementTime = incrementTimeInput.valueAsNumber;
        } else {
            const selectedButton = document.querySelector(
                ".navigator-modal #select-duration button[data-selected='true']"
            ) as HTMLElement;
            if (selectedButton) {
                totalTime = parseInt(
                    selectedButton.querySelector('.total-time')!.textContent!
                );
                incrementTime = parseInt(
                    selectedButton.querySelector('.increment-time')!
                        .textContent!
                );
            }
        }

        // Check the validity of the entered values in mm:ss format.
        totalTime =
            !totalTime && this.lastSelectedDuration.remaining
                ? this.lastSelectedDuration.remaining
                : minutesToMilliseconds(totalTime!);
        totalTime =
            !totalTime ||
            totalTime < MIN_TOTAL_TIME ||
            totalTime > MAX_TOTAL_TIME
                ? DEFAULT_TOTAL_TIME
                : totalTime;

        incrementTime =
            !incrementTime && this.lastSelectedDuration.increment
                ? this.lastSelectedDuration.increment
                : secondsToMilliseconds(incrementTime!);
        incrementTime =
            !incrementTime ||
            incrementTime < MIN_INCREMENT_TIME ||
            incrementTime > MAX_INCREMENT_TIME
                ? DEFAULT_INCREMENT_TIME
                : incrementTime;

        this.lastSelectedDuration = {
            remaining: totalTime,
            increment: incrementTime,
        };
    }

    /**
     * Show the create lobby screen after the user
     * selects the game duration.
     */
    private showCreateLobby(): void {
        this.show(
            'Create a Lobby',
            `<span>Enter your name: </span>
            <div class="input-group" style="padding-top:5px;padding-bottom:5px;">
                <input type="text" id="player-name" placeholder="Your Name" value="${
                    Store.isExist(StoreKey.LastPlayerName)
                        ? Store.load(StoreKey.LastPlayerName)
                        : ''
                }" maxlength="${MAX_PLAYER_NAME_LENGTH}" minlength="${MIN_PLAYER_NAME_LENGTH}" required>
                <button type="submit" data-socket-operation="${
                    SocketOperation.CreateLobby
                }">Create</button>
            </div>
            <div style="text-align:center;margin-top:10px;">
                <button class="button--text" data-menu-operation="${
                    NavigatorModalOperation.Hide
                }">
                    Cancel
                </button>
            </div>
        `
        );
    }

    /**
     * Show the created lobby info.
     */
    public showLobbyInfo(lobbyLink: string): void {
        this.show(
            'Ready to Play',
            `<div class = "input-group" style="padding-bottom:5px;">
                <input type="text" id="lobby-link" placeholder="Lobby Name" value="${lobbyLink}" readonly>
                <button data-clipboard-text="lobby-link">Copy</button>
            </div>
            <span>Share this lobby link with your friend to play together.</span>
            <div style="text-align:center;margin-top:10px;">
                <button class="button--text" data-menu-operation="${NavigatorModalOperation.AskConfirmation}">
                    Cancel
                </button>
            </div>
            `
        );
    }

    /**
     * Get the created lobby settings from the modal.
     */
    public getCreatedLobbySettings(): {
        playerName: string;
        duration: Duration;
    } {
        this.saveEnteredPlayerName();

        return {
            playerName: this.lastEnteredPlayerName,
            duration: this.lastSelectedDuration,
        };
    }

    /**
     * Show the join lobby screen.
     */
    public showJoinLobby(): void {
        this.show(
            'Join a Lobby',
            `<span>Enter your name: </span>
            <div class="input-group" style="padding-top:5px;padding-bottom:5px;">
                <input type="text" id="player-name" placeholder="Your Name" value="${
                    Store.isExist(StoreKey.LastPlayerName)
                        ? Store.load(StoreKey.LastPlayerName)
                        : ''
                }" maxlength="${MAX_PLAYER_NAME_LENGTH}" minlength="${MIN_PLAYER_NAME_LENGTH}" required>
                <button type="submit" data-socket-operation="${
                    SocketOperation.JoinLobby
                }">Play</button>
            </div>
            <div style="text-align:center;margin-top:10px;">
                <button class="button--text" data-menu-operation="${
                    NavigatorModalOperation.Hide
                }">
                    Cancel
                </button>
            </div>
        `
        );
    }

    /**
     * Get the entered player name from the
     * modal. If the player name modal is open.
     *
     * @returns Must be between `MIN_PLAYER_NAME_LENGTH` and
     * `MAX_PLAYER_NAME_LENGTH` characters. If not, it will
     * be `DEFULT_PLAYER_NAME`.
     */
    public getEnteredPlayerName(): string {
        if (
            document
                .getElementById('navigator-modal')!
                .querySelector('#player-name')
        )
            this.saveEnteredPlayerName();
        return this.lastEnteredPlayerName;
    }

    /**
     * Save the entered player name. If the player name
     * modal is open.
     */
    private saveEnteredPlayerName(): void {
        const playerName = (
            document
                .getElementById('navigator-modal')!
                .querySelector('#player-name') as HTMLInputElement
        ).value;
        this.lastEnteredPlayerName =
            playerName.length < MIN_PLAYER_NAME_LENGTH ||
            playerName.length > MAX_PLAYER_NAME_LENGTH
                ? DEFULT_PLAYER_NAME
                : playerName;
    }

    /**
     * Show the play against bot screen after the user
     * selects the play against bot option on the game
     * creator screen. This screen will allow the user
     * to select the difficulty level of the bot.
     */
    private showPlayAgainstBot(): void {
        this.show(
            'Play against Bot',
            `<span>Select the difficulty level of the bot:</span>
            <div class="btn-group-horizontal btn-group-horizontal--triple" style="padding-top:5px;padding-bottom:15px;">
                <button data-selected="false" data-bot-difficulty="${BotDifficulty.Easy}">Easy</button>
                <button data-selected="false" data-bot-difficulty="${BotDifficulty.Medium}">Medium</button>
                <button data-selected="false" data-bot-difficulty="${BotDifficulty.Hard}">Hard</button>
            </div>
            <button type="submit" data-menu-operation="${NavigatorModalOperation.ShowSelectColorAgainsBot}">Next</button>
            <div style="text-align:center;margin-top:10px;">
                <button class="button--text" data-menu-operation="${NavigatorModalOperation.ShowGameCreator}">
                    Cancel
                </button>
            </div>
            `
        );
    }

    /**
     * Get the selected difficulty level of the bot.
     * If the play against bot modal is open.
     */
    private saveSelectedBotDifficulty(): void {
        const selectedButton = document.querySelector(
            ".navigator-modal button[data-selected='true'][data-bot-difficulty]"
        );
        if (!selectedButton) return;
        this.lastSelectedBotDifficulty = parseInt(
            selectedButton.getAttribute('data-bot-difficulty')!
        ) as BotDifficulty;
    }

    /**
     * Show the select color against bot screen after
     * the user selects the difficulty level of the bot.
     */
    private showSelectColorAgainstBot(): void {
        this.show(
            'Play against Bot',
            `<span>Select the color of the bot:</span>
            <div class="btn-group-horizontal btn-group-horizontal--triple" style="padding-top:5px;padding-bottom:15px;">
                <button data-selected="false" data-bot-color="${BotColor.Black}">Black</button>
                <button data-selected="false" data-bot-color="${BotColor.Random}">Random</button>
                <button data-selected="false" data-bot-color="${BotColor.White}">White</button>
            </div>
            <button type="submit" data-menu-operation="${NavigatorModalOperation.PlayAgainstBot}">Play</button>
            <div style="text-align:center;margin-top:10px;">
                <button class="button--text" data-menu-operation="${NavigatorModalOperation.ShowGameCreator}">
                    Cancel
                </button>
            </div>
            `
        );
    }

    /**
     * Save the selected color of the bot.
     * If the play against bot modal is open.
     */
    private saveSelectedBotColor(): void {
        const selectedButton = document.querySelector(
            ".navigator-modal button[data-selected='true'][data-bot-color]"
        );
        if (!selectedButton) return;
        this.lastSelectedBotColor = selectedButton.getAttribute(
            'data-bot-color'
        )! as BotColor;
    }

    /**
     * Get the created bot settings from the modal.
     */
    public getCreatedBotSettings(): BotAttributes {
        this.saveSelectedBotColor();

        return {
            color: this.lastSelectedBotColor,
            difficulty: this.lastSelectedBotDifficulty,
        };
    }

    /**
     * Show the confirmation screen when the user
     * wants to cancel something(currently the game).
     */
    private showConfirmation(): void {
        this.show(
            'Confirmation',
            `<div id = "confirmation">Are you sure you want to cancel the game?
            <br> <br>
            <div class="btn-group-vertical">
                <button data-menu-operation="${NavigatorModalOperation.Undo}">Continue Playing</button>
                <button style="background-color:transparent" data-socket-operation="${SocketOperation.CancelLobby}">Yes, Cancel the Game</button>
            </div></div>`
        );
    }

    /**
     * Show error screen.
     * @param {boolean} okButton - If true, it will
     * show the ok button and the user will be able to
     * close the modal by clicking the ok button. If false,
     * user won't be able to close the modal.
     */
    public showError(message: string, okButton: boolean = true): void {
        this.show(
            'Something Went Wrong',
            `<span>${message}</span>
            <div style="text-align:center;margin-top:10px;">
                ${
                    okButton
                        ? `<button data-menu-operation="${NavigatorModalOperation.Hide}">Ok</button>`
                        : ''
                }
            </div>
            `
        );
        document
            .querySelector('.navigator-modal')!
            .classList.add('navigator-modal--error');
    }

    /**
     * Show the loading screen.
     */
    public showLoading(message: string, showProjectLink: boolean = true): void {
        this.show(
            'Loading',
            `
            <div style="margin-bottom:15px">
                <span>${message}</span>
                ${
                    showProjectLink
                        ? `<br>
                        <small>You can view the project on <a href="${REPOSITORY_URL}" target="_blank">GitHub</a>
                        </small>`
                        : ''
                }
            </div>
            <div class="loader"></div>
            <div style="text-align:center;margin-top:15px;">
                <button class="button--text" data-menu-operation="${
                    NavigatorModalOperation.Hide
                }">
                    Cancel
                </button>
            </div>
            `
        );
    }

    /**
     * Hide the modal.
     */
    public hide(): void {
        document.removeEventListener(
            'click',
            this._boundCloseModalOnOutsideClick
        );
        const navigatorModal = document.querySelector('.navigator-modal');
        if (!navigatorModal) return;
        navigatorModal.remove();
        this.hideModalBackdrop();
    }

    /**
     * Handle the given `NavigatorModalOperation`.
     */
    public handleOperation(operation: NavigatorModalOperation): void {
        switch (operation) {
            case NavigatorModalOperation.ShowGameCreator:
                this.showGameCreator();
                break;
            case NavigatorModalOperation.ShowStartPlayingBoard:
                this.showStartPlayingBoard();
                break;
            case NavigatorModalOperation.ShowCreateLobby:
                this.saveSelectedGameDuration();
                this.showCreateLobby();
                break;
            case NavigatorModalOperation.ShowJoinLobby:
                this.showJoinLobby();
                break;
            case NavigatorModalOperation.ShowSelectDuration:
                this.showSelectDuration();
                break;
            case NavigatorModalOperation.ShowSelectDurationCustom:
                this.showSelectDurationCustom();
                break;
            case NavigatorModalOperation.ShowPlayAgainstBot:
                this.showPlayAgainstBot();
                break;
            case NavigatorModalOperation.ShowSelectColorAgainsBot:
                this.saveSelectedBotDifficulty();
                this.showSelectColorAgainstBot();
                break;
            case NavigatorModalOperation.AskConfirmation:
                this.showConfirmation();
                break;
            case NavigatorModalOperation.Undo:
                this.undo();
                break;
            case NavigatorModalOperation.Hide:
                this.hide();
                break;
        }
    }

    /**
     * Public method to re-render the navbar.
     */
    public mount(): void {
        this.renderComponent(
            this.modalTitle,
            this.modalContent,
            this.modalCloseable,
            this.modalBackdrop,
            this.modalHidden
        );
    }
}
