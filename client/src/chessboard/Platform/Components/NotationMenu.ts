import {
    ChessEvent,
    Color,
    GameStatus,
    PieceIcon,
    PieceType,
    Scores,
} from '@ChessPlatform/chessboard/Chess/Types/index.ts';
import { Component } from './Component.ts';
import { Chess } from '@ChessPlatform/chessboard/Chess/Chess.ts';
import {
    BoardEditorOperation,
    NavigatorModalOperation,
    NotationMenuOperation,
} from '../Types/index.ts';
import { SocketOperation } from '../../Types';
import { Store, StoreKey } from '@ChessPlatform/chessboard/Services/Store.ts';
import { NOTATION_MENU_ID } from '@ChessPlatform/chessboard/Platform/Consts/index.ts';
import { SoundEffect } from '@ChessPlatform/chessboard/Chess/Board/Types/index.ts';
import { TimerNotAvailableError } from '@ChessPlatform/chessboard/Chess/Engine/ChessEngine.ts';

/**
 * Represents the type of the utility menu.
 * Each utility menu contains different buttons
 * like abort game, resign, draw, undo, etc.
 */
enum UtilityMenuType {
    OnlineGame = 'online-game-utility-menu',
    SingleplayerGame = 'singleplayer-game-utility-menu',
    NewGame = 'new-game-utility-menu',
    PlayAgain = 'play-again-utility-menu',
    Confirmation = 'confirmation-utility-menu',
    Offer = 'offer-utility-menu',
}

/**
 * Represents the style of the algebraic notation.
 * For example:
 * - OnlyText: "Qf3"
 * - WithIcons: "&#9819;f3"
 */
export enum NotationStyle {
    OnlyText = 'OnlyText',
    WithIcons = 'WithIcons',
}

/**
 * Represents the configuration of the notation menu.
 */
export interface Config {
    notationStyle: NotationStyle;
}

/**
 * Default configuration of the notation menu.
 */
export const DEFAULT_CONFIG: Config = {
    notationStyle: NotationStyle.WithIcons,
};

/**
 * This class provides the notation table,
 * player cards, utility menu for different
 * game states like online game, singleplayer
 * game, new game, etc. Each utility menu
 * contains different buttons like abort game,
 * resign, draw, undo, etc.
 */
export class NotationMenu extends Component {
    protected whitePlayerName: string = '';
    protected blackPlayerName: string = '';
    public readonly id: string = NOTATION_MENU_ID;
    private readonly chess: Chess;

    private config: Config = DEFAULT_CONFIG;

    private moveCount: number = 0;
    private _activeIntervalId: number = -1;
    private _shownUtilityMenu: UtilityMenuType = UtilityMenuType.NewGame;
    private _activeUtilityMenu: UtilityMenuType | null = null;
    private _confirmedOperation: NotationMenuOperation | null = null;

    /**
     * Constructor of the NotationMenu class.
     */
    constructor(chess: Chess) {
        super();
        this.chess = chess;
        this.loadCSS('notation-menu.css');
        this.renderComponent();
        this.addEventListeners();
        this.loadLocalStorage();
        this.addShortcutListeners();
        this.update(true);
    }

    /**
     * Set the configuration of the notation menu.
     */
    public setConfig(config: Partial<NotationMenu['config']>): void {
        this.config = { ...this.config, ...config };

        // Update the notation table according to the new configuration.
        if (config.notationStyle) {
            document.getElementById('notations')!.innerHTML = '';
            this.setNotations(this.chess.getAlgebraicNotation());
        }
    }

    /**
     * This function adds event listeners that are related to the notation menu.
     */
    private addEventListeners(): void {
        document.addEventListener(ChessEvent.onGameOver, (() => {
            this.stopOpponentTimerIfActive(true);
            this.displayPlayAgainUtilityMenu();
        }) as EventListener);

        document.addEventListener(ChessEvent.onTakeBack, ((
            event: CustomEvent
        ) => {
            this.deleteLastNotation(event.detail.undoColor);
        }) as EventListener);

        const updateTriggers = [
            ChessEvent.onGameCreated,
            ChessEvent.onPieceCreated,
            ChessEvent.onPieceRemoved,
            ChessEvent.onPieceMoved,
            ChessEvent.onTakeBackOrForward,
            ChessEvent.onTakeBack,
            ChessEvent.onGameOver,
        ];

        updateTriggers.forEach((trigger) => {
            document.addEventListener(trigger, () => {
                if (!Store.load(StoreKey.WasBoardEditorEnabled)) this.update();
            });
        });
    }

    /**
     * Load the local storage data.
     */
    private loadLocalStorage(): void {
        if (Store.isExist(StoreKey.WasBoardEditorEnabled)) {
            this.hide();
        }

        if (Store.isExist(StoreKey.LastBoard)) {
            if (Store.isExist(StoreKey.LastLobbyConnection))
                this.displayOnlineGameUtilityMenu();
            else this.displayNewGameUtilityMenu();
        }

        if (Store.isExist(StoreKey.LastBot)) {
            const botAttributes = Store.load(StoreKey.LastBot)!;
            if (botAttributes.color === Color.White) this.flip();
            this.displaySingleplayerGameUtilityMenu();
        }
    }

    /**
     * Get default new game utility menu content.
     */
    private getNewGameUtilityMenuContent(): string {
        return `<button class="menu-item" data-menu-operation="${NavigatorModalOperation.ShowGameCreator}" data-tooltip-text="Create New Game">+ New Game</button>`;
    }

    /**
     * Get default lobby utility menu content.
     */
    private getOnlineGameUtilityMenuContent(): string {
        return `
            ${
                this.chess.getMoveHistory().length < 2
                    ? `<button class="menu-item" data-menu-operation="${NotationMenuOperation.AbortGame}"  data-tooltip-text="Abort the Game">&#x2715; Abort</button>`
                    : `<button class="menu-item" data-menu-operation="${NotationMenuOperation.SendUndoOffer}" data-tooltip-text="Send Undo Offer">↺ Undo</button>`
            }
            <button class="menu-item" data-menu-operation="${
                NotationMenuOperation.SendDrawOffer
            }" data-tooltip-text="Send Draw Offer">Draw</button>
            <button class="menu-item" data-menu-operation="${
                NotationMenuOperation.Resign
            }" data-tooltip-text="Resign From Game">⚐ Resign</button>
        `;
    }

    /**
     * Get default single player game utility menu content.
     */
    private getSingleplayerGameUtilityMenuContent(): string {
        return `
            ${
                this.chess.getMoveHistory().length < 1
                    ? `<button class="menu-item" data-menu-operation="${NotationMenuOperation.AbortGame}"  data-tooltip-text="Abort the Game">&#x2715; Abort</button>`
                    : `<button class="menu-item" data-menu-operation="${NotationMenuOperation.UndoMove}" data-tooltip-text="Take Back Last Move">↺ Undo</button>`
            }
            <button class="menu-item" data-menu-operation="${
                NotationMenuOperation.Resign
            }" data-tooltip-text="Resign From Game">⚐ Resign</button>
        `;
    }

    /**
     * Get default play again utility menu content.
     */
    private getPlayAgainUtilityMenuContent(): string {
        return `
            <button class="menu-item" data-menu-operation="${
                this._activeUtilityMenu === UtilityMenuType.OnlineGame
                    ? NotationMenuOperation.SendPlayAgainOffer
                    : NotationMenuOperation.PlayAgain
            }" data-tooltip-text="Play Again from Same Start">Play Again</button>
            <button class="menu-item" data-menu-operation="${
                NavigatorModalOperation.ShowGameCreator
            }" data-tooltip-text="Create New Game">+ New Game</button>
        `;
    }

    /**
     * Get default confirmation utility menu content.
     */
    private getConfirmationUtilityMenuContent(): string {
        return `
            <button class="menu-item hidden" data-socket-operation="${SocketOperation.CancelOffer}" data-tooltip-text="Cancel Offer">Cancel</button>
            <button class="menu-item" data-menu-operation="${NotationMenuOperation.GoBack}" data-tooltip-text="Go Back">Back</button>
            <button class="menu-item" id="confirm-button" data-socket-operation="" data-menu-operation="" data-tooltip-text=""></button>
        `;
    }

    /**
     * Get default offer utility menu content.
     */
    private getOfferUtilityMenuContent(): string {
        return `
            <span class="offer-message"></span>
            <div class="offer-buttons">
                <button class="menu-item" data-socket-operation="${SocketOperation.DeclineSentOffer}" data-tooltip-text="Decline Offer">Decline</button>
                <button class="menu-item" id="accept-button" data-socket-operation="" data-tooltip-text=""></button>
            </div>
        `;
    }

    /**
     * Adds keyboard shortcuts for navigating the chess game.
     * - "ArrowRight" moves the game forward.
     * - "ArrowLeft" moves the game backward.
     * - "ArrowUp" jumps to the first move.
     * - "ArrowDown" jumps to the last move.
     */
    private addShortcutListeners(): void {
        document.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'ArrowRight':
                    this.takeForward();
                    break;
                case 'ArrowLeft':
                    this.takeBack();
                    break;
                case 'ArrowUp':
                    this.goToFirstMove();
                    break;
                case 'ArrowDown':
                    this.goToLastMove();
                    break;
            }
        });
    }

    /**
     * This function render the notation table.
     */
    protected renderComponent(): void {
        const blackPlayerSection = `
            <div class="player-section your-turn-effect" id="black-player-section">
                <div class="player-name-container">
                    <div class="player-name" id="black-player-name">
                        Black Player
                    </div>
                    <div class="duration hidden" id="black-player-duration">
                        <div style="display: flex;align-items: end;">
                            <span class="minute-second">00:00</span> <small class="decisecond">.00</small>
                        </div>
                    </div>
                    <div class="player-status">
                        <span class="status-icon" id="black-player-status"></span>
                    </div>
                </div>
                <div class="score-table" id="white-captured-pieces"></div>
            </div>
        `;

        const whitePlayerSection = `
            <div class="player-section your-turn-effect" id="white-player-section">
                <div class="player-name-container">
                    <div class="player-name" id="white-player-name">
                        White Player
                    </div>
                    <div class="duration hidden" id="white-player-duration">
                        <div style="display: flex;align-items: end;">
                            <span class="minute-second">00:00</span> <small class="decisecond">.00</small>
                        </div>
                    </div>
                    <div class="player-status">
                        <span class="status-icon" id="white-player-status"></span>
                    </div>
                </div>
                <div class="score-table" id="black-captured-pieces"></div>
            </div>
        `;

        let whitePlayerSectionMobileLoadingContainer = document.getElementById(
            'white-player-section-mobile-loading-container'
        );
        let blackPlayerSectionMobileLoadingContainer = document.getElementById(
            'black-player-section-mobile-loading-container'
        );
        const isMobileView = window.innerWidth < 900;
        this.loadHTML(
            NOTATION_MENU_ID,
            `
                ${
                    !isMobileView || !blackPlayerSectionMobileLoadingContainer
                        ? blackPlayerSection
                        : ''
                }
                <div>
                    <table id = "notation-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>White</th>
                                <th>Black</th>
                            </tr>
                        </thead>
                        <tbody id = "notations"></tbody>
                    </table>
                    <div class="utility-menu">
                        <button class="menu-item" data-menu-operation="${
                            BoardEditorOperation.FlipBoard
                        }" data-tooltip-text="Flip Board">F</button>
                        <button class="menu-item" data-menu-operation="${
                            NotationMenuOperation.FirstMove
                        }" data-tooltip-text="Go First Move">⟪</button>
                        <button class="menu-item" data-menu-operation="${
                            NotationMenuOperation.PreviousMove
                        }" data-tooltip-text="Go Previous Move">❮</button>
                        <button class="menu-item" data-menu-operation="${
                            NotationMenuOperation.NextMove
                        }" data-tooltip-text="Go Next Move">❯</button>
                        <button class="menu-item" data-menu-operation="${
                            NotationMenuOperation.LastMove
                        }" data-tooltip-text="Go Last Move">⟫</button>
                        <button class="menu-item" data-menu-operation="${
                            NotationMenuOperation.ToggleUtilityMenu
                        }">☰</button>
                    </div>
                    <div class="utility-menu utility-toggle-menu visible">
                        <div class="utility-toggle-menu-section active" id="${
                            UtilityMenuType.NewGame
                        }">
                            ${this.getNewGameUtilityMenuContent()}
                        </div>
                        <div class="utility-toggle-menu-section" id="${
                            UtilityMenuType.OnlineGame
                        }">
                            ${this.getOnlineGameUtilityMenuContent()}
                        </div>
                         <div class="utility-toggle-menu-section" id="${
                             UtilityMenuType.SingleplayerGame
                         }">
                            ${this.getSingleplayerGameUtilityMenuContent()}
                        </div>
                        <div class="utility-toggle-menu-section" id="${
                            UtilityMenuType.PlayAgain
                        }">
                            ${this.getPlayAgainUtilityMenuContent()}
                        </div>
                        <div class="utility-toggle-menu-section confirmation" id="${
                            UtilityMenuType.Confirmation
                        }">
                            ${this.getConfirmationUtilityMenuContent()}
                        </div>
                        <div class="utility-toggle-menu-section confirmation" id="${
                            UtilityMenuType.Offer
                        }">
                            ${this.getOfferUtilityMenuContent()}
                        </div>
                    </div>
                </div>
                ${
                    !isMobileView || !whitePlayerSectionMobileLoadingContainer
                        ? whitePlayerSection
                        : ''
                }
        `
        );

        if (isMobileView) {
            if (whitePlayerSectionMobileLoadingContainer)
                this.loadHTML(
                    'white-player-section-mobile-loading-container',
                    whitePlayerSection
                );
            if (blackPlayerSectionMobileLoadingContainer)
                this.loadHTML(
                    'black-player-section-mobile-loading-container',
                    blackPlayerSection
                );
        } else {
            whitePlayerSectionMobileLoadingContainer?.remove();
            blackPlayerSectionMobileLoadingContainer?.remove();
            whitePlayerSectionMobileLoadingContainer = null;
            blackPlayerSectionMobileLoadingContainer = null;
        }

        const chessboard = document.getElementById('chessboard')!;
        const notationMenu = document.getElementById(NOTATION_MENU_ID)!;
        let breakpointCircle = true;
        const reorder = (isFirstTime: boolean = false) => {
            const isMobile = window.innerWidth < 900;
            const isTablet =
                window.innerWidth >= 900 && window.innerWidth < 1250;
            const isDesktop = window.innerWidth >= 1250;

            if (isMobile && (breakpointCircle || isFirstTime)) {
                chessboard.before(
                    document.querySelector('.player-section:first-child')!
                );
                chessboard.after(
                    document.querySelector('.player-section:last-child')! || ''
                );
                breakpointCircle = false;
            } else if (isTablet && (!breakpointCircle || isFirstTime)) {
                notationMenu.prepend(
                    document.querySelector('.player-section:first-child')!
                );
                notationMenu.append(
                    document.querySelector('#chessboard ~ .player-section') ||
                        document.querySelector('.player-section:last-child')!
                );
                breakpointCircle = true;
            } else if (isDesktop && (breakpointCircle || isFirstTime)) {
                notationMenu.prepend(
                    document.querySelector('.player-section:first-child')!
                );
                notationMenu.append(
                    document.querySelector('.player-section:last-child')!
                );
                breakpointCircle = false;
            }
        };

        if (
            isMobileView &&
            (!whitePlayerSectionMobileLoadingContainer ||
                !blackPlayerSectionMobileLoadingContainer)
        ) {
            reorder(true);
        }

        // window.addEventListener('resize', () => {
        //     if (whitePlayerSectionMobileLoadingContainer) {
        //         whitePlayerSectionMobileLoadingContainer.outerHTML =
        //             whitePlayerSectionMobileLoadingContainer.innerHTML;
        //         whitePlayerSectionMobileLoadingContainer = null;
        //     }
        //     if (blackPlayerSectionMobileLoadingContainer) {
        //         blackPlayerSectionMobileLoadingContainer.outerHTML =
        //             blackPlayerSectionMobileLoadingContainer.innerHTML;
        //         blackPlayerSectionMobileLoadingContainer = null;
        //     }

        //     reorder();
        // });
    }

    /**
     * This function returns the adjacent move of the given move.
     *
     * @param {number} increment The increment value.
     * If the current notation element is given then the function
     * returns the adjacent move of the given notation element by
     * using the increment value. If the current notation element
     * is not given then the function returns the last move if the
     * increment value is < 0, or the first move if the increment value
     * is >= 0.
     *
     * @param {HTMLElement|null} currentNotationElement The current notation element.
     * If the current notation element is given then the function
     * returns the adjacent move of the given notation element by
     * using the increment value. If the current notation element
     * is not given then the function returns the last move or the
     * first move according to the increment value. If there is no adjacent
     * move then the function returns null.
     *
     * @example getAdjacentMove(-1) returns the last move.
     * @example getAdjacentMove(1) returns the first move.
     * @example getAdjacentMove(-1, currentNotationElement) returns the previous move
     * of the given notation element.
     * @example getAdjacentMove(1, currentNotationElement) returns the next move
     * of the given notation element.
     */
    private getAdjacentMove(
        increment: number,
        currentNotationElement: HTMLElement | null = null
    ): HTMLElement | null {
        const notations = document.getElementById('notations')!;
        if (increment < 0 && !currentNotationElement) {
            return (
                notations.querySelector(
                    'tr:last-child td:last-child:has(.move)'
                ) ||
                notations.querySelector(
                    'tr:last-child td:nth-child(2):has(.move)'
                )
            );
        } else if (increment >= 0 && !currentNotationElement) {
            return document.querySelector(
                '#notations tr:first-child td:nth-child(2)'
            );
        }

        if (!currentNotationElement) return null;

        const moves = Array.from(
            document
                .getElementById('notations')!
                .querySelectorAll('td:has(.move)')
        );
        if (moves.length == 0) return null;

        const index = moves.indexOf(currentNotationElement);
        if (index == -1) return null;

        return index + increment >= 0 && moves.length > index + increment
            ? (moves[index + increment] as HTMLElement)
            : null;
    }

    /**
     * This function adds the given notations to the table. If the notations
     * table is empty then the function creates a new table and adds the given
     * every notation as a row. If the notations table is not empty then the
     * function adds the last notation to the table.
     */
    private setNotations(notations: ReadonlyArray<string>): void {
        /**
         * This function formats the unicode notation for adding to
         * the table notation. For example, if the notation is "&#9812;f3"
         * then the function will return "<span class="piece-icon">&#9812;</span><span class="move">f3</span>".
         * If the notation is "f3" then the function will return "<span class="move">f3</span>".
         */
        const formatUnicodeNotation = (notation: string): string => {
            if (notation.startsWith('&')) {
                return `<span class="piece-icon">${notation.slice(
                    0,
                    7
                )}</span><span class="move">${notation.slice(7)}</span>`;
            }

            return `<span class="move">${notation}</span>`;
        };

        /**
         * If notation is white then create new notation row/tr and add as td,
         * otherwise add the notation to the last row as td.
         */
        const notationMenu: HTMLElement = document.getElementById('notations')!;
        const notationCount =
            notationMenu.querySelectorAll('td:has(.move)').length;
        if (notationMenu.innerHTML.trim() === '') {
            for (let i = 0; i < notations.length; i += 1) {
                const notationUnicoded = formatUnicodeNotation(
                    this.config.notationStyle === NotationStyle.WithIcons
                        ? this.convertStringNotationToUnicodedNotation(
                              notations[i]
                          )
                        : notations[i]
                );
                if (i % 2 == 0) {
                    notationMenu.innerHTML += `
                        <tr>
                            <td><span>${i / 2 + 1}</span></td>
                            <td>${notationUnicoded}</td>
                            <td></td>
                        </tr>
                    `;
                } else {
                    notationMenu.lastElementChild!.innerHTML =
                        notationMenu.lastElementChild!.innerHTML.replace(
                            '<td></td>',
                            `<td>${notationUnicoded}</td>`
                        );
                }
            }

            notationMenu.addEventListener('click', (event) => {
                if (
                    event.target instanceof HTMLElement &&
                    event.target.closest('td')
                ) {
                    const clickedNotation = event.target.closest(
                        'td'
                    ) as HTMLTableCellElement;
                    if (!clickedNotation.querySelector('.move')) return;
                    this.chess.goToSpecificMove(
                        Array.from(
                            notationMenu.querySelectorAll(
                                'td:not(td:first-child)'
                            )
                        ).indexOf(clickedNotation)
                    );
                    this.highlightNotation(clickedNotation);
                }
            });
        } else if (notationCount !== this.chess.getAlgebraicNotation().length) {
            const lastRow: HTMLElement =
                notationMenu.lastElementChild as HTMLElement;
            const lastNotation: string = formatUnicodeNotation(
                this.config.notationStyle === NotationStyle.WithIcons
                    ? this.convertStringNotationToUnicodedNotation(
                          notations[notations.length - 1]
                      )
                    : notations[notations.length - 1]
            );

            if (notations.length % 2 == 0)
                lastRow.innerHTML = lastRow.innerHTML.replace(
                    `<td></td>`,
                    `<td>${lastNotation}</td>`
                );
            else
                lastRow.insertAdjacentHTML(
                    'afterend',
                    `<tr><td><span>${Math.ceil(
                        notations.length / 2
                    )}</span></td><td>${lastNotation}</td><td></td></tr>`
                );
        }

        this.highlightNotation();

        const notationTable: HTMLElement = document
            .getElementById('notation-table')!
            .querySelector('tbody')!;
        setTimeout(() => {
            notationTable.scrollTop = notationTable.scrollHeight;
        }, 0);

        this.moveCount = notations.length;
    }

    /**
     * This function deletes the last notation from the table.
     * @param {Color|null} color The color of last notation to be
     * deleted for example if the color is white then the whole row
     * will be deleted, if the color is black then only the last column
     * will be deleted. If the color is null then the last notation will
     * be deleted.
     *
     * @example deleteLastNotation(Color.White) deletes the last white notation.
     * @example deleteLastNotation(Color.Black) deletes the last black notation.
     * @example deleteLastNotation() deletes the last notation.
     */
    private deleteLastNotation(color: Color | null = null): void {
        const notationMenu: HTMLElement = document.getElementById('notations')!;
        const lastRow = notationMenu.lastElementChild as HTMLElement;
        if (!lastRow) return;

        const lastMoveLength = lastRow.querySelectorAll('.move').length;
        this.moveCount -= lastMoveLength;
        if (color == Color.White) {
            lastRow.remove();
        } else {
            if (lastMoveLength == 1) {
                lastRow.remove();
                this.deleteLastNotation(color);
            } else {
                const lastMove = lastRow.querySelector('td:last-child')!;
                if (lastMove && lastMove.querySelector('.move'))
                    lastMove.innerHTML = '';
            }
        }

        this.highlightNotation();
    }

    /**
     * This function takes one move back from the current move. Only
     * on the board doesn't affect the game state.
     */
    private takeBack(): void {
        const previousMoveElement = this.getAdjacentMove(
            -1,
            document.querySelector('.current-move') as HTMLElement
        );
        if (previousMoveElement) {
            this.highlightNotation(previousMoveElement);
            const notationTable: HTMLElement = document
                .getElementById('notation-table')!
                .querySelector('tbody')!;
            const previousMoveElementRect =
                previousMoveElement.getBoundingClientRect();
            if (
                previousMoveElementRect.top <=
                notationTable.getBoundingClientRect().top
            ) {
                notationTable.scrollTop -= previousMoveElementRect.height;
            }
            this.chess.takeBack();
        }
    }

    /**
     * This function takes one move forward from the current move. Only
     * on the board doesn't affect the game state.
     */
    private takeForward(): void {
        const nextMoveElement = this.getAdjacentMove(
            1,
            document.querySelector('.current-move') as HTMLElement
        );
        if (nextMoveElement) {
            this.highlightNotation(nextMoveElement);
            const notationTable: HTMLElement = document
                .getElementById('notation-table')!
                .querySelector('tbody')!;
            const nextMoveElementRect = nextMoveElement.getBoundingClientRect();
            if (
                nextMoveElementRect.top + nextMoveElementRect.height >
                notationTable.getBoundingClientRect().bottom
            ) {
                notationTable.scrollTop += nextMoveElementRect.height;
            }
            this.chess.takeForward();
        }
    }

    /**
     * This function goes to the first move of the game. Only
     * on the board doesn't affect the game state.
     */
    private goToFirstMove(): void {
        this.highlightNotation(this.getAdjacentMove(0));
        document
            .getElementById('notation-table')!
            .querySelector('tbody')!.scrollTop = 0;
        this.chess.goToSpecificMove(0);
    }

    /**
     * This function goes to the last move of the game. Only
     * on the board doesn't affect the game state.
     */
    private goToLastMove(): void {
        this.highlightNotation();
        const notationTable: HTMLElement = document
            .getElementById('notation-table')!
            .querySelector('tbody')!;
        notationTable.scrollTop = notationTable.scrollHeight;
        this.chess.goToSpecificMove(this.chess.getMoveHistory().length - 1);
    }

    /**
     * This function shows the given notation as the current move.
     *
     * @param {HTMLElement|null} notationTd The notation td element.
     * This function shows the last notation that has a move
     * as the current move if the notationTd is not given. If
     * the notationTd is given then the given notationTd will be
     * shown as the current move.
     */
    private highlightNotation(notationTd: HTMLElement | null = null): void {
        const currentMove = document.querySelector('.current-move');
        if (currentMove) {
            currentMove?.classList.remove('current-move');
            if (currentMove.classList.length === 0)
                currentMove.removeAttribute('class');
        }

        // Add current move effect to the last notation.
        // First td is the move number, second td is the white move,
        // and the last td is the black move. Since there is 3 td
        // in the row, and the last td that has a move must be the
        // current/last move.
        if (!notationTd) {
            const adjacentMove = this.getAdjacentMove(-1);
            if (adjacentMove) adjacentMove.classList.add('current-move');
        } else {
            notationTd.classList.add('current-move');
        }
    }

    /**
     * This function shows the score of the players top and bottom of the table.
     */
    private setScore(scores: Scores): void {
        /**
         * Piece Icons
         */
        const blackCapturedPieces = document.getElementById(
            'black-captured-pieces'
        );
        const whiteCapturedPieces = document.getElementById(
            'white-captured-pieces'
        );

        if (!blackCapturedPieces || !whiteCapturedPieces) return;

        blackCapturedPieces.innerHTML = '';
        whiteCapturedPieces.innerHTML = '';

        /**
         * This function adds the piece icon to the captured pieces section
         * by sorting the pieces according to their unicode code.
         * For example, if the pieces are [Pawn, Rook, Queen] then the
         * order of the pieces will be Queen, Rook, Pawn.
         */
        const addPieceIconSorted = (pieces: PieceType[], color: Color) => {
            if (pieces.length === 0) return;

            const capturedPieces =
                color == Color.White
                    ? whiteCapturedPieces
                    : blackCapturedPieces;
            // sort the pieces according to their unicode code.
            pieces.sort((a, b) =>
                this.getPieceUnicode(a).localeCompare(this.getPieceUnicode(b))
            );
            pieces.forEach((piece) => {
                const pieceUnicodeIcon = this.getPieceUnicode(piece);
                if (
                    capturedPieces.querySelectorAll('.piece-icon').length === 0
                ) {
                    capturedPieces.innerHTML = `<div class="piece-icon">${pieceUnicodeIcon}</div>`;
                } else {
                    capturedPieces.innerHTML += `<div class="piece-icon">${pieceUnicodeIcon}</div>`;
                }
            });
        };

        addPieceIconSorted(scores[Color.White].pieces, Color.Black);
        addPieceIconSorted(scores[Color.Black].pieces, Color.White);

        /**
         * Scores
         */
        const whiteScore = scores[Color.White].score;
        const blackScore = scores[Color.Black].score;

        const blackScoreElement = blackCapturedPieces.querySelector('.score');
        const whiteScoreElement = whiteCapturedPieces.querySelector('.score');

        /**
         * This function adds the score to the score table.
         */
        const addScore = (score: number, color: Color) => {
            const capturedPieces =
                color == Color.White
                    ? whiteCapturedPieces
                    : blackCapturedPieces;
            const scoreElement =
                color == Color.White ? whiteScoreElement : blackScoreElement;
            if (!scoreElement)
                capturedPieces.innerHTML +=
                    score <= 0
                        ? ''
                        : ' ' + `<div class="score">+${score}</div>`;
            else scoreElement.textContent = `+${score}`;
        };

        addScore(whiteScore, Color.Black);
        addScore(blackScore, Color.White);
    }

    /**
     * This function returns the unicode of the piece
     * according to the given piece type.
     */
    private getPieceUnicode(piece: PieceType | string): string {
        switch (piece) {
            case PieceType.Pawn:
                return '&#9823;'; // &#9817;
            case PieceType.Knight:
                return '&#9822;'; // &#9816;
            case PieceType.Bishop:
                return '&#9821;'; // &#9815;
            case PieceType.Rook:
                return '&#9820;'; // &#9814;
            case PieceType.Queen:
                return '&#9819;'; // &#9813;
            case PieceType.King:
                return '&#9818;'; // &#9812;
            default:
                return '';
        }
    }

    /**
     * This function converts the string notation to unicode notation.
     * @example convertStringNotationToUnicodedNotation("Kf3") returns "&#9812;f3"
     */
    private convertStringNotationToUnicodedNotation(notation: string): string {
        if (notation.length <= 2 || notation == 'O-O-O') return notation;

        const pieceInfo = notation[0].toUpperCase() as PieceIcon;
        switch (pieceInfo) {
            case PieceIcon.WhiteKing:
                return this.getPieceUnicode(PieceType.King) + notation.slice(1);
            case PieceIcon.WhiteQueen:
                return (
                    this.getPieceUnicode(PieceType.Queen) + notation.slice(1)
                );
            case PieceIcon.WhiteRook:
                return this.getPieceUnicode(PieceType.Rook) + notation.slice(1);
            case PieceIcon.WhiteBishop:
                return (
                    this.getPieceUnicode(PieceType.Bishop) + notation.slice(1)
                );
            case PieceIcon.WhiteKnight:
                return (
                    this.getPieceUnicode(PieceType.Knight) + notation.slice(1)
                );
            default:
                return notation;
        }
    }

    /**
     * This function opens/closes the utility menu.
     */
    private toggleUtilityMenu(): void {
        document
            .querySelector(`#${NOTATION_MENU_ID} .utility-toggle-menu`)!
            .classList.toggle('visible');
    }

    /**
     * Show the new game utility menu section. This menu contains
     * new game and info buttons.
     */
    public displayNewGameUtilityMenu(): void {
        this.resetConfirmedOperation();

        document
            .querySelector('.utility-toggle-menu-section.active')!
            .classList.remove('active');

        this.loadHTML(
            UtilityMenuType.NewGame,
            this.getNewGameUtilityMenuContent()
        );
        document
            .getElementById(UtilityMenuType.NewGame)!
            .classList.add('active');
        this._activeUtilityMenu = UtilityMenuType.NewGame;
        this._shownUtilityMenu = UtilityMenuType.NewGame;
    }

    /**
     * Show the online game utility menu section. This menu contains
     * undo or abort, draw and resign buttons.
     */
    public displayOnlineGameUtilityMenu(): void {
        this.resetConfirmedOperation();

        document
            .querySelector('.utility-toggle-menu-section.active')!
            .classList.remove('active');

        this.loadHTML(
            UtilityMenuType.OnlineGame,
            this.getOnlineGameUtilityMenuContent()
        );
        document
            .getElementById(UtilityMenuType.OnlineGame)!
            .classList.add('active');
        this._activeUtilityMenu = UtilityMenuType.OnlineGame;
        this._shownUtilityMenu = UtilityMenuType.OnlineGame;
    }

    /**
     * Show the single player game utility menu section. This menu contains
     * undo or abort and resign buttons.
     */
    public displaySingleplayerGameUtilityMenu(): void {
        this.resetConfirmedOperation();

        document
            .querySelector('.utility-toggle-menu-section.active')!
            .classList.remove('active');

        this.loadHTML(
            UtilityMenuType.SingleplayerGame,
            this.getSingleplayerGameUtilityMenuContent()
        );
        document
            .getElementById(UtilityMenuType.SingleplayerGame)!
            .classList.add('active');
        this._activeUtilityMenu = UtilityMenuType.SingleplayerGame;
        this._shownUtilityMenu = UtilityMenuType.SingleplayerGame;
    }

    /**
     * Show the play again utility menu section. This menu contains
     * new game and play again buttons. This menu is shown when the
     * online game is finished.
     */
    public displayPlayAgainUtilityMenu(): void {
        this.resetConfirmedOperation();

        document
            .querySelector('.utility-toggle-menu-section.active')!
            .classList.remove('active');

        this.loadHTML(
            UtilityMenuType.PlayAgain,
            this.getPlayAgainUtilityMenuContent()
        );
        document
            .getElementById(UtilityMenuType.PlayAgain)!
            .classList.add('active');
        this._shownUtilityMenu = UtilityMenuType.PlayAgain;
    }

    /**
     * Update the notation table and the score of the players.
     * @param force If force is true then the notation table will be updated
     * even if the notation is not changed.
     */
    public update(force: boolean = false): void {
        if (
            [
                GameStatus.WhiteVictory,
                GameStatus.BlackVictory,
                GameStatus.Draw,
            ].includes(this.chess.getGameStatus())
        ) {
            this.stopOpponentTimerIfActive();
            this.displayPlayAgainUtilityMenu();
        }

        // Even if the move count is 0, the score
        // might be different than 0 if the board
        // is started from a specific position.
        // but there is no need to update the notations
        // because there can't be any notation.
        this.setScore(this.chess.getScores(false));

        const moveCount = this.chess.getMoveHistory().length;
        if (!force && (moveCount == 0 || moveCount == this.moveCount)) return;

        this.handleAbortUndoButton();
        this.setNotations(this.chess.getAlgebraicNotation());
        this.changeIndicator();

        const playerTimer = document
            .getElementById(
                `${this.chess.getTurnColor().toLowerCase()}-player-duration`
            )
            ?.classList.contains('active');
        if (
            this.chess.getDurations() &&
            (force ||
                (moveCount >= 2 &&
                    !playerTimer &&
                    [
                        GameStatus.WhiteInCheck,
                        GameStatus.BlackInCheck,
                        GameStatus.InPlay,
                    ].includes(this.chess.getGameStatus())))
        )
            this.startOrUpdateTimers();
    }

    /**
     * Handle the abort or undo button. If the move count is
     * enough for the undo then the undo button will be shown
     * otherwise the abort button will be shown.
     */
    private handleAbortUndoButton(): void {
        const abortButton = document.querySelector(`
            .utility-toggle-menu-section.active [data-menu-operation="${NotationMenuOperation.AbortGame}"]
        `);
        const newGameButton = document.querySelector(`
            .utility-toggle-menu-section.active [data-menu-operation="${NavigatorModalOperation.ShowGameCreator}"]
        `);

        const minMoveCountForUndo =
            this._activeUtilityMenu === UtilityMenuType.OnlineGame ? 2 : 1;
        if (abortButton || newGameButton) {
            if (this.chess.getMoveHistory().length >= minMoveCountForUndo) {
                if (this._activeUtilityMenu === UtilityMenuType.OnlineGame) {
                    this.displayOnlineGameUtilityMenu();
                } else if (
                    this._activeUtilityMenu ===
                        UtilityMenuType.SingleplayerGame ||
                    this._activeUtilityMenu === UtilityMenuType.NewGame
                ) {
                    this.displaySingleplayerGameUtilityMenu();
                }
            }
        }
    }

    /**
     * Set the turn indicator to the given color.
     */
    public setTurnIndicator(color: Color): void {
        document
            .querySelector(`.your-turn-effect`)
            ?.classList.remove('your-turn-effect');
        document
            .getElementById(`${color.toLowerCase()}-player-section`)!
            .classList.add('your-turn-effect');
    }

    /**
     * This function changes the indicator from the opponent to the
     * current player.
     */
    private changeIndicator(): void {
        const current_player_color = this.chess.getTurnColor();
        const previous_player_color =
            current_player_color == Color.White ? Color.Black : Color.White;
        document
            .getElementById(
                `${previous_player_color.toLowerCase()}-player-section`
            )!
            .classList.remove('your-turn-effect');
        document
            .getElementById(
                `${current_player_color.toLowerCase()}-player-section`
            )!
            .classList.add('your-turn-effect');
    }

    /**
     * Show the player cards with the given player names and
     * their online status.
     */
    public setPlayersOnPlayerCards(
        whitePlayer: { name: string; isOnline: boolean },
        blackPlayer: { name: string; isOnline: boolean }
    ): void {
        this.showPlayerCards();

        this.displayWhitePlayerName(whitePlayer.name);
        if (whitePlayer.isOnline) {
            this.updatePlayerAsOnline(Color.White);
        } else {
            this.updatePlayerAsOffline(Color.White);
        }

        this.displayBlackPlayerName(blackPlayer.name);
        if (blackPlayer.isOnline) {
            this.updatePlayerAsOnline(Color.Black);
        } else {
            this.updatePlayerAsOffline(Color.Black);
        }

        this.showPlayerDurations();
    }

    /**
     * Hide shown player cards(multiplayer or singleplayer).
     */
    public hidePlayerCards(): void {
        (
            document.querySelectorAll(
                '.player-section'
            ) as NodeListOf<HTMLElement>
        ).forEach((playerCard) => {
            playerCard.classList.add('hidden');
        });
    }

    /**
     * Show the player cards(multiplayer or singleplayer).
     */
    public showPlayerCards(): void {
        (
            document.querySelectorAll(
                '.player-section'
            ) as NodeListOf<HTMLElement>
        ).forEach((playerCard) => {
            playerCard.classList.remove('hidden');
        });
    }

    /**
     * Add white player name to the menu.
     */
    public displayWhitePlayerName(name: string): void {
        const whitePlayerName = document.getElementById(`white-player-name`)!;
        if (!whitePlayerName) return;
        whitePlayerName.textContent = name;
    }

    /**
     * Add black player name to the menu.
     */
    public displayBlackPlayerName(name: string): void {
        const blackPlayerName = document.getElementById(`black-player-name`)!;
        if (!blackPlayerName) return;
        blackPlayerName.textContent = name;
    }

    /**
     * Change the player status to online.
     */
    public updatePlayerAsOnline(color: Color): void {
        const playerStatus = document.getElementById(
            `${color.toLowerCase()}-player-status`
        )!;
        if (!playerStatus) return;
        playerStatus.classList.add('online');
        playerStatus.classList.remove('offline');
    }

    /**
     * Change the player status to offline.
     */
    public updatePlayerAsOffline(color: Color): void {
        const playerStatus = document.getElementById(
            `${color.toLowerCase()}-player-status`
        )!;
        if (!playerStatus) return;
        playerStatus.classList.add('offline');
        playerStatus.classList.remove('online');
    }

    /**
     * Display the white player duration on the notation menu.
     */
    private showPlayerDurations(): void {
        if (!this.chess.getDurations()) return;

        // White
        let milliseconds = Math.round(
            this.chess.getPlayersRemainingTime()[Color.White]
        );
        let [minutes, seconds] = this.formatRemainingTimeForTimer(milliseconds);

        const whitePlayerDuration = document.getElementById(
            'white-player-duration'
        )!;
        whitePlayerDuration.classList.remove('hidden');
        whitePlayerDuration.querySelector(
            '.minute-second'
        )!.textContent = `${minutes.toString().padStart(2, '0')}:${seconds
            .toString()
            .padStart(2, '0')}`;

        // Black
        milliseconds = Math.round(
            this.chess.getPlayersRemainingTime()[Color.Black]
        );
        [minutes, seconds] = this.formatRemainingTimeForTimer(milliseconds);

        const blackPlayerDuration = document.getElementById(
            'black-player-duration'
        )!;
        blackPlayerDuration.classList.remove('hidden');
        blackPlayerDuration.querySelector(
            '.minute-second'
        )!.textContent = `${minutes.toString().padStart(2, '0')}:${seconds
            .toString()
            .padStart(2, '0')}`;
    }

    /**
     * Start/Update the timers by starting the timer of the player
     * and stopping the timer of the opponent.
     */
    private startOrUpdateTimers(): void {
        this.stopOpponentTimerIfActive();
        this.startPlayerTimer(this.chess.getTurnColor());
    }

    /**
     * Start the given player's timer by checking the remaining time
     * of the player in every 100 milliseconds from the engine.
     */
    private startPlayerTimer(color: Color): void {
        const playerTimer = document.getElementById(
            `${color.toLowerCase()}-player-duration`
        )!;
        playerTimer.classList.add('active');

        const playerMinuteSecond = playerTimer.querySelector('.minute-second')!;
        const playerDecisecond = playerTimer.querySelector('.decisecond')!;

        let isDecisecondActive = false;
        this._activeIntervalId = setInterval(() => {
            try {
                const [minutes, seconds, deciseconds] =
                    this.formatRemainingTimeForTimer(
                        Math.round(this.chess.getPlayersRemainingTime()[color])
                    );

                if (minutes < 0 || seconds < 0 || deciseconds < 0) return;

                playerMinuteSecond.textContent = `${minutes
                    .toString()
                    .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

                if (minutes <= 0 && seconds <= 10) {
                    if (!isDecisecondActive) {
                        this.chess.board.playSound(SoundEffect.LowTime);
                        playerDecisecond.classList.add('active');
                        isDecisecondActive = true;
                    }
                    playerDecisecond.textContent = '.' + deciseconds;
                }
            } catch (e) {
                if (e instanceof TimerNotAvailableError) {
                    this.stopOpponentTimerIfActive();
                }
            }
        }, 100) as unknown as number;
    }

    /**
     * Format the given milliseconds to the mm:ss format.
     * @returns [minutes, seconds, deciseconds]
     */
    private formatRemainingTimeForTimer(milliseconds: number): number[] {
        const totalDeciseconds = Math.floor(milliseconds / 100);
        const totalSeconds = Math.floor(totalDeciseconds / 10);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const deciseconds = totalDeciseconds % 10;
        return [minutes, seconds, deciseconds];
    }

    /**
     * Stop the oppenent's timer. Clearing the active
     * interval id is enough to stop the timer because
     * only one timer/interval can be active at a time.
     * @param {boolean} showAsZero If showAsZero is true then
     * the active timer will be shown as 00:00.0. This is used
     * when there is a mismatch between the client and server like
     * when client receives the game over message from the server
     * while there is a time left on the active timer. In this case,
     * the active timer should be shown as 00:00.0.
     */
    private stopOpponentTimerIfActive(showAsZero: boolean = false): void {
        document
            .querySelectorAll('.player-section .duration.active')
            .forEach((playerTimer) => {
                if (showAsZero) {
                    playerTimer.querySelector('.minute-second')!.textContent =
                        '00:00';
                    playerTimer.querySelector('.decisecond')!.textContent =
                        '.0';
                }
                playerTimer.classList.remove('active');
            });

        if (this._activeIntervalId !== -1)
            clearInterval(this._activeIntervalId);
    }

    /**
     * Flip the notation table.
     */
    public flip(): void {
        let playerScoreSectionOnTop =
            document.querySelector('.player-section')!;
        playerScoreSectionOnTop.parentElement!.append(playerScoreSectionOnTop);

        playerScoreSectionOnTop = document.querySelector('.player-section')!;
        playerScoreSectionOnTop.parentElement!.prepend(
            playerScoreSectionOnTop!
        );
    }

    /**
     * This function sets the notation table to the
     * initial state.
     */
    public clear(): void {
        this.renderComponent();
        this.moveCount = 0;
        this.displayNewGameUtilityMenu();
    }

    /**
     * Ask for confirmation before making the given operation.
     */
    private askConfirmation(
        confirmationOperation:
            | NotationMenuOperation.AbortGame
            | NotationMenuOperation.Resign
            | NotationMenuOperation.UndoMove
            | NotationMenuOperation.SendDrawOffer
            | NotationMenuOperation.SendUndoOffer
            | NotationMenuOperation.SendPlayAgainOffer
    ): void {
        if (this.isOperationConfirmed(confirmationOperation)) return;

        document
            .querySelector('.utility-toggle-menu-section.active')!
            .classList.remove('active');

        this.loadHTML(
            UtilityMenuType.Confirmation,
            this.getConfirmationUtilityMenuContent()
        );

        const confirmationMenu = document.getElementById(
            UtilityMenuType.Confirmation
        )!;
        confirmationMenu.classList.add('active');

        const textContent = document.querySelector(
            `[data-menu-operation="${confirmationOperation}"]`
        )!.textContent;
        const tooltipText = document
            .querySelector(`[data-menu-operation="${confirmationOperation}"]`)!
            .getAttribute('data-tooltip-text')!;

        const confirmButton =
            confirmationMenu.querySelector('#confirm-button')!;
        confirmButton.textContent = textContent;
        confirmButton.setAttribute('data-tooltip-text', tooltipText);

        // This is a hacky way to set the operation to the button.
        // Since the operation is not a socket operation, but has
        // same value with the "correct" socket operation, we can
        // set the operation to the button and use it as a socket
        // operation. For example, SocketOperation.Resign="Resign"
        // is equal to NotationMenuOperation.Resign="Resign" so we
        // can set the operation to the button and use it as a socket
        // operation.
        setTimeout(() => {
            confirmButton.setAttribute(
                this._activeUtilityMenu === UtilityMenuType.OnlineGame
                    ? 'data-socket-operation'
                    : 'data-menu-operation',
                confirmationOperation
            );
            this.confirmOperation(confirmationOperation);
        }, 0);
    }

    /**
     * Set the given operation as the confirmed operation.
     */
    private confirmOperation(operation: NotationMenuOperation): void {
        this._confirmedOperation = operation;
    }

    /**
     * Check if the given operation is confirmed.
     */
    public isOperationConfirmed(operation: NotationMenuOperation): boolean {
        return this._confirmedOperation === operation;
    }

    /**
     * Clear the confirmed operation if it is set.
     */
    private resetConfirmedOperation(): void {
        this._confirmedOperation = null;
    }

    /**
     * Show the received offer on the offer menu. This function
     * should be called after the offer is received from the server.
     */
    private _showReceivedOffer(
        offerMessage: string,
        offerOperation:
            | SocketOperation.AcceptDrawOffer
            | SocketOperation.AcceptPlayAgainOffer
            | SocketOperation.AcceptUndoOffer
    ): void {
        document
            .querySelector('.utility-toggle-menu-section.active')!
            .classList.remove('active');
        this.loadHTML(UtilityMenuType.Offer, this.getOfferUtilityMenuContent());

        const offerMenu = document.getElementById(UtilityMenuType.Offer)!;
        offerMenu.classList.add('active');

        offerMenu.querySelector('.offer-message')!.textContent = offerMessage;

        const acceptButton = offerMenu.querySelector('#accept-button')!;
        acceptButton.textContent = 'Accept';
        acceptButton.setAttribute('data-tooltip-text', 'Accept Offer');
        acceptButton.setAttribute(
            this._activeUtilityMenu === UtilityMenuType.OnlineGame
                ? 'data-socket-operation'
                : 'data-menu-operation',
            offerOperation
        );
    }

    /**
     * Show the draw offer from the opponent. If the player accepts,
     * client will send the accepted message to the server. If the player
     * declines, client will send the declined message to the server. Shouldn't
     * be called without the offer coming from the server.
     */
    public showReceivedDrawOffer(): void {
        this._showReceivedOffer(
            'Opponent has offered a draw.',
            SocketOperation.AcceptDrawOffer
        );
    }

    /**
     * Show the undo offer from the opponent. If the player accepts,
     * client will send the accepted message to the server. If the player
     * declines, client will send the declined message to the server. Shouldn't
     * be called without the offer coming from the server.
     */
    public showReceivedUndoOffer(): void {
        this._showReceivedOffer(
            'Opponent has offered to undo the last move.',
            SocketOperation.AcceptUndoOffer
        );
    }

    /**
     * Show the play again offer screen that has 2 options to
     * accept or decline. If the player accepts, client will send
     * the accepted message to the server. If the player declines,
     * client will send the declined message to the server. Shouldn't
     * be called without the offer coming from the server.
     */
    public showReceivedPlayAgainOffer(): void {
        this._showReceivedOffer(
            'Your opponet has offered to play again.',
            SocketOperation.AcceptPlayAgainOffer
        );
    }

    /**
     * Show the sent request on the information menu. This function
     * is a feedback for the player that the request is sent and
     * should be called after the request is sent.
     */
    private _showOfferSentFeedback(sentRequestButton: HTMLElement): void {
        if (!sentRequestButton) return;
        sentRequestButton.textContent = 'Offered';
        sentRequestButton.setAttribute('disabled', 'true');
        sentRequestButton.setAttribute(
            'data-tooltip-text',
            'Opponent waiting...'
        );

        const confirmationMenu = document.getElementById(
            UtilityMenuType.Confirmation
        )!;
        confirmationMenu
            .querySelector(
                `[data-menu-operation="${NotationMenuOperation.GoBack}"]`
            )!
            .classList.add('hidden');
        confirmationMenu
            .querySelector(
                `[data-socket-operation="${SocketOperation.CancelOffer}"]`
            )!
            .classList.remove('hidden');
    }

    /**
     * Show the given message on the information menu. This function
     * is a feedback for the player that the play again offer is sent.
     * This function should be called after the play again offer is sent.
     */
    public showPlayAgainSentFeedback(): void {
        this._showOfferSentFeedback(
            document.querySelector(
                `[data-socket-operation="${SocketOperation.SendPlayAgainOffer}"]`
            )!
        );
    }

    /**
     * Show the given message on the information menu. This function
     * is a feedback for the player that the draw offer is sent.
     * This function should be called after the draw offer is sent.
     */
    public showDrawOfferSentFeedback(): void {
        this._showOfferSentFeedback(
            document.querySelector(
                `[data-socket-operation="${NotationMenuOperation.SendDrawOffer}"]`
            )!
        );
    }

    /**
     * Show the given message on the information menu. This function
     * is a feedback for the player that the undo offer is sent.
     * This function should be called after the undo offer is sent.
     */
    public showUndoOfferSentFeedback(): void {
        this._showOfferSentFeedback(
            document.querySelector(
                `[data-socket-operation="${NotationMenuOperation.SendUndoOffer}"]`
            )!
        );
    }

    /**
     * Back to the previous menu. This function should be called
     * after the offer menu is opened and the player declines
     * the offer or sender cancels the offer.
     */
    public goBack(): void {
        switch (this._shownUtilityMenu) {
            case UtilityMenuType.NewGame:
                this.displayNewGameUtilityMenu();
                break;
            case UtilityMenuType.SingleplayerGame:
                this.displaySingleplayerGameUtilityMenu();
                break;
            case UtilityMenuType.OnlineGame:
                this.displayOnlineGameUtilityMenu();
                break;
            case UtilityMenuType.PlayAgain:
                this.displayPlayAgainUtilityMenu();
                break;
        }

        this.resetConfirmedOperation();
    }

    /**
     * Hide the notation menu.
     */
    public hide(): void {
        this.hidePlayerCards();
        (
            document.getElementById(NOTATION_MENU_ID)! as HTMLElement
        ).style.display = 'none';
    }

    /**
     * Hide the notation menu.
     */
    public show(): void {
        (
            document.getElementById(NOTATION_MENU_ID)! as HTMLElement
        ).style.display = 'flex';
        this.showPlayerCards();
    }

    /**
     * Handle the given `NotationMenuOperation`.
     */
    public handleOperation(operation: NotationMenuOperation): void {
        switch (operation) {
            case NotationMenuOperation.ToggleUtilityMenu:
                this.toggleUtilityMenu();
                break;
            case NotationMenuOperation.ShowOnlineGameUtilityMenu:
                this.displayOnlineGameUtilityMenu();
                break;
            case NotationMenuOperation.ShowSingleplayerGameUtilityMenu:
                this.displaySingleplayerGameUtilityMenu();
                break;
            case NotationMenuOperation.UndoMove:
                this.askConfirmation(NotationMenuOperation.UndoMove);
                break;
            case NotationMenuOperation.Resign:
                this.askConfirmation(NotationMenuOperation.Resign);
                break;
            case NotationMenuOperation.AbortGame:
                this.askConfirmation(NotationMenuOperation.AbortGame);
                break;
            case NotationMenuOperation.SendDrawOffer:
                this.askConfirmation(NotationMenuOperation.SendDrawOffer);
                break;
            case NotationMenuOperation.SendUndoOffer:
                this.askConfirmation(NotationMenuOperation.SendUndoOffer);
                break;
            case NotationMenuOperation.SendPlayAgainOffer:
                this.askConfirmation(NotationMenuOperation.SendPlayAgainOffer);
                break;
            case NotationMenuOperation.PreviousMove:
                this.takeBack();
                break;
            case NotationMenuOperation.NextMove:
                this.takeForward();
                break;
            case NotationMenuOperation.FirstMove:
                this.goToFirstMove();
                break;
            case NotationMenuOperation.LastMove:
                this.goToLastMove();
                break;
            case NotationMenuOperation.GoBack:
                this.goBack();
                break;
        }
    }

    /**
     * Public method to re-render the notation menu.
     */
    public mount(): void {
        this.displayWhitePlayerName(this.whitePlayerName);
        this.displayBlackPlayerName(this.blackPlayerName);
        this.renderComponent();
    }
}
