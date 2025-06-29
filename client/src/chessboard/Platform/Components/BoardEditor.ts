import {
    PlatformEvent,
    BoardEditorOperation,
    NavigatorModalOperation,
} from '../Types';
import { Chess } from '@ChessPlatform/chessboard/Chess/Chess';
import {
    ChessEvent,
    Color,
    GameStatus,
    JsonNotation,
    PieceType,
    Square,
    StartPosition,
} from '@ChessPlatform/chessboard/Chess/Types';
import { Component } from './Component';
import { Store, StoreKey } from '@ChessPlatform/chessboard/Services/Store';
import {
    BOARD_CREATOR_ID,
    PIECE_CREATOR_ID,
} from '@ChessPlatform/chessboard/Platform/Consts';

/**
 * Represents the modes of the board creator.
 * Custom mode is for creating a board with a
 * custom FEN notation through the input field.
 * Template mode is for creating a board with a
 * template FEN notation through the select field.
 */
enum BoardCreatorMode {
    Custom = 'custom-board-creator-mode',
    Template = 'template-board-creator-mode',
}

/**
 * Decorator to check if the editor mode is enabled or not
 * before executing the function that requires the editor mode to be enabled.
 */
function isEditorModeEnable() {
    return function (
        target: unknown,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;

        descriptor.value = function (...args: unknown[]) {
            if (!BoardEditor.isEditorModeEnable()) {
                throw new Error('The editor mode is not enabled.');
            }
            return originalMethod.apply(this, args);
        };
    };
}

/**
 * This class provide a form to create a new board.
 */
export class BoardEditor extends Component {
    public readonly id: string = isEditorModeEnable()
        ? PIECE_CREATOR_ID
        : BOARD_CREATOR_ID;
    private readonly chess: Chess;

    private static _isEditorModeEnable: boolean = false;
    private _boardEditorObserver: MutationObserver | null = null;
    private _currentBoardCreatorMode: BoardCreatorMode =
        BoardCreatorMode.Custom;

    /**
     * Constructor of the BoardCreator class.
     */
    constructor(chess: Chess) {
        super();
        this.chess = chess;
        this.renderComponent();
        this.addEventListeners();
        this.loadLocalStorage();
    }

    /**
     * This function adds event listeners that are related to the notation menu.
     */
    private addEventListeners(): void {
        const updateTriggers = [
            ChessEvent.onGameCreated,
            ChessEvent.onPieceCreated,
            ChessEvent.onPieceRemoved,
            ChessEvent.onPieceMoved,
            ChessEvent.onTakeBack,
            ChessEvent.onTakeBackOrForward,
            ChessEvent.onGameOver,
        ];

        updateTriggers.forEach((trigger) => {
            document.addEventListener(trigger, () => {
                this.updateFen();
            });
        });
    }

    /**
     * This function renders the game creator.
     */
    protected renderComponent(): void {
        let boardCreatorMobileLoadingContainer = document.getElementById(
            `${BOARD_CREATOR_ID}-mobile-loading-container`
        );
        let boardCreatorTabletLoadingContainer = document.getElementById(
            `${BOARD_CREATOR_ID}-tablet-loading-container`
        );
        const isMobileView = window.innerWidth < 900;
        const isTabletView =
            window.innerWidth >= 900 && window.innerWidth < 1250;
        this.loadHTML(
            isMobileView && boardCreatorMobileLoadingContainer
                ? boardCreatorMobileLoadingContainer!.id
                : isTabletView && boardCreatorTabletLoadingContainer
                ? boardCreatorTabletLoadingContainer!.id
                : BOARD_CREATOR_ID,
            `
          <div class = "board-creator ${BoardCreatorMode.Template}">
              <div class = "border-inset"><button data-menu-operation="${
                  BoardEditorOperation.ChangeBoardCreatorMode
              }" disabled="true">Custom</button></div>
              <select disabled="true">${this.getTemplateOptions()}</select>
              <div class = "border-inset"><button data-menu-operation="${
                  BoardEditorOperation.CreateBoard
              }" disabled="true">Load</button></div>
          </div>
          <div class = "board-creator ${BoardCreatorMode.Custom} visible">
            <div class = "border-inset"><button data-menu-operation="${
                BoardEditorOperation.ChangeBoardCreatorMode
            }" disabled="true">Templates</button></div>
            <input type="text" id="fen-notation" placeholder="FEN Notation" value = "${
                StartPosition.Standard
            }">
            <div class = "border-inset"><button data-menu-operation="${
                BoardEditorOperation.CreateBoard
            }" disabled="true">Load</button></div>
          </div>
        `
        );
        this.loadCSS('board-editor/board-creator.css');

        document
            .getElementById('fen-notation')!
            .addEventListener('focus', (e) => {
                (e.target as HTMLInputElement).select();
            });

        const removeLoadingContainer = () => {
            if (
                boardCreatorMobileLoadingContainer ||
                boardCreatorTabletLoadingContainer
            ) {
                if (isMobileView || isTabletView) {
                    document
                        .getElementById(BOARD_CREATOR_ID)!
                        .append(
                            ...(isMobileView
                                ? boardCreatorMobileLoadingContainer!.childNodes
                                : boardCreatorTabletLoadingContainer!
                                      .childNodes)
                        );
                }
                boardCreatorMobileLoadingContainer?.remove();
                boardCreatorMobileLoadingContainer = null;
                boardCreatorTabletLoadingContainer?.remove();
                boardCreatorTabletLoadingContainer = null;
                window.removeEventListener('resize', removeLoadingContainer);
            }
        };

        window.addEventListener('resize', removeLoadingContainer);
    }

    /**
     * This function checks the cache and loads the game from the cache
     * if there is a game in the cache.
     */
    private loadLocalStorage(): void {
        if (Store.isExist(StoreKey.LastBot)) {
            const botAttributes = Store.load(StoreKey.LastBot)!;
            if (botAttributes.color === Color.White) this.flip();
        }

        if (Store.isExist(StoreKey.WasBoardEditorEnabled))
            this.enableEditorMode();
    }

    /**
     * This function changes the notation menu to piece editor.
     */
    private createPieceEditor(): void {
        if (!BoardEditor.isEditorModeEnable()) return;
        this.loadHTML(
            PIECE_CREATOR_ID,
            `
            <table id = "piece-table">
                <tbody id = "piece-options">
                    <tr>
                        <td>
                            <div class="piece-option">
                                <div class="piece" data-piece="King" data-color="White"></div>
                            </div>
                        </td>
                        <td>
                            <div class="piece-option">
                                <div class="piece" data-piece="King" data-color="Black"></div>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div class="piece-option">
                                <div class="piece" data-piece="Queen" data-color="White"></div>
                            </div>
                        </td>
                        <td>
                            <div class="piece-option">
                                <div class="piece" data-piece="Queen" data-color="Black"></div>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div class="piece-option">
                                <div class="piece" data-piece="Rook" data-color="White"></div>
                            </div>
                        </td>
                        <td>
                            <div class="piece-option">
                                <div class="piece" data-piece="Rook" data-color="Black"></div>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div class="piece-option">
                                <div class="piece" data-piece="Bishop" data-color="White"></div>
                            </div>
                        </td>
                        <td>
                            <div class="piece-option">
                                <div class="piece" data-piece="Bishop" data-color="Black"></div>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div class="piece-option">
                                <div class="piece" data-piece="Knight" data-color="White"></div>
                            </div>
                        </td>
                        <td>
                            <div class="piece-option">
                                <div class="piece" data-piece="Knight" data-color="Black"></div>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div class="piece-option">
                                <div class="piece" data-piece="Pawn" data-color="White"></div>
                            </div>
                        </td>
                        <td>
                            <div class="piece-option">
                                <div class="piece" data-piece="Pawn" data-color="Black"></div>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
            <div class="utility-menu">
                <button class="menu-item" data-menu-operation="${BoardEditorOperation.FlipBoard}" data-tooltip-text="Flip Board">F</button>
                <button class="menu-item" data-menu-operation="${BoardEditorOperation.EnableMovePieceCursorMode}" data-tooltip-text="Move Piece">+</button>
                <button class="menu-item" data-menu-operation="${BoardEditorOperation.EnableRemovePieceCursorMode}" data-tooltip-text="Remove Piece">-</button>
                <button class="menu-item" data-menu-operation="${BoardEditorOperation.ClearBoard}" data-tooltip-text="Clear Board">X</button>
                <button class="menu-item" data-menu-operation="${BoardEditorOperation.ResetBoard}" data-tooltip-text="Reset Board">R</button>
                <button class="menu-item" data-menu-operation="${BoardEditorOperation.ToggleBoardEditorUtilityMenu}">☰</button>
            </div>
            <div class="utility-menu utility-toggle-menu visible">
                <div class="utility-toggle-menu-section active">
                    <button class="menu-item" data-menu-operation="${NavigatorModalOperation.ShowStartPlayingBoard}" data-tooltip-text="Start the Board" disabled="true">Start</button>
                    <button class="menu-item" data-menu-operation="${NavigatorModalOperation.ShowGameCreator}" data-tooltip-text="Create New Game">+ New Game</button>
                </div>
            </div>
        `
        );
        this.loadCSS('board-editor/piece-creator.css');
    }

    /**
     * This function removes the piece editor.
     */
    @isEditorModeEnable()
    private removePieceEditor(): void {
        document.getElementById(PIECE_CREATOR_ID)!.innerHTML = '';
    }

    /**
     * This function enables the editor mode.
     */
    public enableEditorMode(): void {
        if (BoardEditor.isEditorModeEnable()) return;
        BoardEditor._isEditorModeEnable = true;

        if (this._currentBoardCreatorMode == BoardCreatorMode.Template)
            this.changeBoardCreatorMode();

        this.createPieceEditor();
        this.enableBoardCreator();
        this.createEditableBoard();
        this.enableBoardObserver();
        Store.save(StoreKey.WasBoardEditorEnabled, true);
    }

    /**
     * This function disables the editor mode.
     */
    @isEditorModeEnable()
    public disableEditorMode(): void {
        if (this._currentBoardCreatorMode == BoardCreatorMode.Template)
            this.changeBoardCreatorMode();

        this.disableBoardCreator();
        this.disableCursorMode();
        this.removePieceEditor();
        this.disableBoardObserver();
        BoardEditor._isEditorModeEnable = false;
    }

    /**
     * Check if the board creator is enabled or not.
     */
    public static isEditorModeEnable(): boolean {
        return BoardEditor._isEditorModeEnable;
    }

    /**
     * This function initiates the board observer for dispatching the event
     * when there is a change in the board that made by the editor.
     */
    @isEditorModeEnable()
    private enableBoardObserver(): void {
        this._boardEditorObserver = new MutationObserver(
            (mutations: MutationRecord[]) => {
                mutations.forEach((mutation: MutationRecord) => {
                    if (
                        (mutation.target as HTMLElement).hasAttribute(
                            'data-menu-operation'
                        )
                    ) {
                        document.dispatchEvent(
                            new CustomEvent(PlatformEvent.onOperationMounted, {
                                detail: { selector: mutation.target },
                            })
                        );
                    }
                });
            }
        );

        this._boardEditorObserver.observe(
            document.getElementById('chessboard')!,
            {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['data-menu-operation'],
                characterData: false,
            }
        );
    }

    /**
     * This function disables the board observer.
     */
    private disableBoardObserver(): void {
        if (this._boardEditorObserver) this._boardEditorObserver.disconnect();
    }

    /**
     * This function adds drag and drop event listeners to the pieces and squares
     * for editing the board.
     */
    @isEditorModeEnable()
    private addDragAndDropEventListeners(): void {
        // Drag event listeners for the pieces.
        (
            document.querySelectorAll(`
            #chessboard .piece, #${PIECE_CREATOR_ID} .piece
        `) as NodeListOf<HTMLElement>
        ).forEach((piece: HTMLElement) => {
            this.makePieceSelectable(piece);
        });

        // Drop event listeners for the squares.
        this.chess.board
            .getAllSquares()
            .forEach((squareElement: HTMLElement) => {
                // For creating the piece on the board by clicking on the square.
                squareElement.setAttribute(
                    'data-menu-operation',
                    BoardEditorOperation.CreatePiece
                );

                // For creating the piece on the board by dropping the piece on the square.
                squareElement.addEventListener('dragover', (e: DragEvent) => {
                    e.preventDefault();
                });
                squareElement.addEventListener('drop', (e: DragEvent) => {
                    e.preventDefault();
                    this.createPiece(squareElement);
                    const selectedPieceOption: HTMLElement =
                        document.querySelector(
                            '.selected-option'
                        ) as HTMLElement;
                    if (selectedPieceOption.closest('#chessboard'))
                        this.removePiece(selectedPieceOption);
                });
            });
    }

    /**
     * Get the template options for the board creator.
     * The options are the starting positions of the
     * chess board.
     */
    private getTemplateOptions(): string {
        let options: string = '';
        Object.entries(StartPosition).forEach(([key, value]) => {
            options += `<option value="${value}">${key}</option>`;
        });
        return options;
    }

    /**
     * This function if the current mode is custom mode or not.
     */
    private isBoardCreatorModeCustom(): boolean {
        return this._currentBoardCreatorMode == BoardCreatorMode.Custom;
    }

    /**
     * This function enables the board creator.
     */
    private enableBoardCreator(): void {
        (
            document.querySelectorAll(
                '.board-creator button, .board-creator select'
            ) as NodeListOf<HTMLElement>
        ).forEach((element: HTMLElement) => {
            element.removeAttribute('disabled');
        });
    }

    /**
     * This function disables the board creator.
     */
    private disableBoardCreator(): void {
        (
            document.querySelectorAll(
                '.board-creator button, .board-creator select'
            ) as NodeListOf<HTMLElement>
        ).forEach((element: HTMLElement) => {
            element.setAttribute('disabled', 'true');
        });
    }

    /**
     * This function changes the board creator form
     * mode from custom to template or vice versa.
     */
    private changeBoardCreatorMode(): void {
        const boardCreator: HTMLElement = document.querySelector(
            '.board-creator.visible'
        ) as HTMLElement;
        boardCreator.classList.remove('visible');
        this._currentBoardCreatorMode =
            this._currentBoardCreatorMode === BoardCreatorMode.Template
                ? BoardCreatorMode.Custom
                : BoardCreatorMode.Template;
        document
            .querySelector(`.board-creator.${this._currentBoardCreatorMode}`)!
            .classList.add('visible');
    }

    /**
     * This function creates a new editable board
     * for the board editor.
     */
    public createEditableBoard(
        fenNotation: string | StartPosition | null = null
    ): void {
        fenNotation = fenNotation || this.getShownFen();
        fenNotation = fenNotation.replace(/\d+ \d+$/, '0 1');
        this.chess.createGame(fenNotation);
        this._prepareBoardEditorForGame();
    }

    /**
     * This function prepares the board editor for the
     * created game. Checks if the editor mode is
     * enabled or not, adds the drag and drop event
     * listeners to the pieces and squares, and enables
     * the move piece cursor mode. If the current mode is
     * template mode, it changes the mode to custom mode.
     */
    private _prepareBoardEditorForGame(): void {
        if (BoardEditor.isEditorModeEnable()) {
            this.chess.board.lock(true);
            this.chess.board.removeEffectFromAllSquares();
            this.addDragAndDropEventListeners();
            this.enableMovePieceCursorMode();
        }

        if (this._currentBoardCreatorMode == BoardCreatorMode.Template)
            this.changeBoardCreatorMode();
    }

    /**
     * This function creates a new board with the board creator.
     */
    public createBoard(
        fenNotation: string | StartPosition | JsonNotation | null = null
    ): void {
        this.chess.createGame(fenNotation || this.getShownFen());
        this._prepareBoardEditorForGame();
    }

    /**
     * This function creates the selected piece on the board.
     */
    @isEditorModeEnable()
    private createPiece(selectedSquare: HTMLElement): void {
        const selectedPieceOption: HTMLElement = document.querySelector(
            '.selected-option .piece'
        ) as HTMLElement;
        if (
            selectedSquare.classList.contains('square') &&
            selectedPieceOption !== null
        ) {
            this.chess.createPiece(
                selectedPieceOption.getAttribute('data-color') as Color,
                selectedPieceOption.getAttribute('data-piece') as PieceType,
                this.chess.board.getSquareId(selectedSquare) as Square
            );
            this.makePieceSelectable(
                selectedSquare.querySelector('.piece') as HTMLElement
            );
        }
    }

    /**
     * Clear the current selected option effects on the editor
     * and select the new tool.
     */
    @isEditorModeEnable()
    private selectOption(selectedOption: HTMLElement): void {
        const currentSelectedOption: HTMLElement = document.querySelector(
            '.selected-option'
        ) as HTMLElement;
        if (currentSelectedOption)
            currentSelectedOption.classList.remove('selected-option');

        selectedOption.classList.add('selected-option');

        (
            document.querySelectorAll(
                '#chessboard, #chessboard .piece, #chessboard .square'
            ) as NodeListOf<HTMLElement>
        ).forEach((piece: HTMLElement) => {
            piece.setAttribute('style', 'cursor: pointer !important');
        });
    }

    /**
     * This function select the piece on the piece creator for creating a new piece.
     */
    @isEditorModeEnable()
    private makePieceSelectable(piece: HTMLElement): void {
        if (piece.classList.contains('piece')) {
            piece.parentElement!.setAttribute(
                'data-menu-operation',
                BoardEditorOperation.CreatePiece
            );
            piece.setAttribute('draggable', 'true');
            piece.parentElement!.addEventListener('dragstart', () => {
                if (piece.parentElement)
                    this.selectOption(piece.parentElement!);
            });
            piece.parentElement!.addEventListener('dragend', (e: DragEvent) => {
                if (e.dataTransfer!.dropEffect === 'none')
                    this.removePiece(piece.parentElement!);
            });
            if (!piece.closest('#chessboard')) {
                piece.parentElement!.addEventListener('click', () => {
                    this.selectOption(piece.parentElement!);
                });
            }
        }
    }

    /**
     * Remove the piece from the board.
     */
    @isEditorModeEnable()
    private removePiece(squareElement: HTMLElement): void {
        if (!squareElement || !this.chess.board.getSquareId(squareElement))
            return;

        this.chess.removePiece(
            this.chess.board.getSquareId(squareElement) as Square
        );
        squareElement.setAttribute(
            'data-menu-operation',
            BoardEditorOperation.CreatePiece
        );
    }

    /**
     * This function clears the board.
     */
    @isEditorModeEnable()
    private clearBoard(): void {
        const tempLastCreatedBoard = Store.load(StoreKey.LastCreatedBoard);
        this.createBoard(StartPosition.Empty);
        Store.save(StoreKey.LastCreatedBoard, tempLastCreatedBoard);
    }

    /**
     * This function create a new board with
     * the saved FEN notation.
     */
    @isEditorModeEnable()
    private resetBoard(): void {
        this.createBoard(
            Store.load(StoreKey.LastCreatedBoard) || StartPosition.Standard
        );
    }

    /**
     * This function enables the add piece cursor mode.
     */
    @isEditorModeEnable()
    private enableMovePieceCursorMode(): void {
        this.selectOption(
            document.querySelector(`
                [data-menu-operation="${BoardEditorOperation.EnableMovePieceCursorMode}"]
            `) as HTMLElement
        );

        this.chess.board
            .getAllSquares()
            .forEach((squareElement: HTMLElement) => {
                if (this.chess.board.getPieceElementOnSquare(squareElement))
                    squareElement.removeAttribute('data-menu-operation');
            });
    }

    /**
     * This function enables the remove piece cursor mode.
     */
    @isEditorModeEnable()
    private enableRemovePieceCursorMode(): void {
        this.selectOption(
            document.querySelector(`
                [data-menu-operation="${BoardEditorOperation.EnableRemovePieceCursorMode}"]
            `) as HTMLElement
        );

        this.chess.board
            .getAllSquares()
            .forEach((squareElement: HTMLElement) => {
                if (this.chess.board.getPieceElementOnSquare(squareElement)) {
                    squareElement.setAttribute(
                        'data-menu-operation',
                        BoardEditorOperation.RemovePiece
                    );
                }
            });

        (
            document.querySelectorAll(
                '#chessboard, #chessboard .piece, #chessboard .square'
            ) as NodeListOf<HTMLElement>
        ).forEach((piece: HTMLElement) => {
            piece.setAttribute('style', 'cursor: no-drop !important');
        });
    }

    /**
     * This function disables the cursor mode.
     */
    @isEditorModeEnable()
    private disableCursorMode(): void {
        this.chess.board
            .getAllSquares()
            .forEach((squareElement: HTMLElement) => {
                squareElement.removeAttribute('data-menu-operation');
            });

        (
            document.querySelectorAll(
                '#chessboard, #chessboard .piece, #chessboard .square'
            ) as NodeListOf<HTMLElement>
        ).forEach((piece: HTMLElement) => {
            piece.removeAttribute('style');
        });
    }

    /**
     * Enable the start game button.
     */
    @isEditorModeEnable()
    private enableStartGameButton(): void {
        const startButton: HTMLElement = document.querySelector(
            `[data-menu-operation="${NavigatorModalOperation.ShowStartPlayingBoard}"]`
        ) as HTMLElement;
        startButton.removeAttribute('disabled');
    }

    /**
     * Disable the start game button.
     */
    @isEditorModeEnable()
    private disableStartGameButton(): void {
        const startButton: HTMLElement = document.querySelector(
            `[data-menu-operation="${NavigatorModalOperation.ShowStartPlayingBoard}"]`
        ) as HTMLElement;
        startButton.setAttribute('disabled', 'true');
    }

    /**
     * This function flips the board.
     */
    public flip(): void {
        this.chess.board.flip();
    }

    /**
     * Get the form value of the custom or template mode.
     */
    public getShownFen(): string {
        let formValue: string;

        if (this._currentBoardCreatorMode == BoardCreatorMode.Custom)
            formValue = (
                document.querySelector(
                    `.${BoardCreatorMode.Custom} input`
                ) as HTMLInputElement
            ).value;
        else if (this._currentBoardCreatorMode == BoardCreatorMode.Template)
            formValue = (
                document.querySelector(
                    `.${BoardCreatorMode.Template} select`
                ) as HTMLSelectElement
            ).value;

        return formValue!;
    }

    /**
     * This function shows the FEN notation on the form.
     */
    public updateFen(): void {
        if (!this.isBoardCreatorModeCustom()) this.changeBoardCreatorMode();
        const inputElement = document.querySelector(
            `.${BoardCreatorMode.Custom} input`
        ) as HTMLInputElement;
        inputElement.value = this.chess.getGameAsFenNotation(false);

        if (BoardEditor.isEditorModeEnable()) {
            if (
                [GameStatus.ReadyToStart, GameStatus.InPlay].includes(
                    this.chess.getGameStatus()
                )
            )
                this.enableStartGameButton();
            else this.disableStartGameButton();
        }
    }

    /**
     * This function toggles the utility menu.
     */
    private toggleUtilityMenu(): void {
        document
            .querySelector(`#${PIECE_CREATOR_ID} .utility-toggle-menu`)!
            .classList.toggle('visible');
    }

    /**
     * This function handles the board creator operation.
     */
    public handleOperation(
        operation: BoardEditorOperation,
        menuItem: HTMLElement
    ): void {
        switch (operation) {
            case BoardEditorOperation.CreatePiece:
                this.createPiece(menuItem);
                break;
            case BoardEditorOperation.RemovePiece:
                this.removePiece(menuItem);
                break;
            case BoardEditorOperation.ClearBoard:
                this.clearBoard();
                break;
            case BoardEditorOperation.ResetBoard:
                this.resetBoard();
                break;
            case BoardEditorOperation.EnableMovePieceCursorMode:
                this.enableMovePieceCursorMode();
                break;
            case BoardEditorOperation.EnableRemovePieceCursorMode:
                this.enableRemovePieceCursorMode();
                break;
            case BoardEditorOperation.ChangeBoardCreatorMode:
                this.changeBoardCreatorMode();
                break;
            case BoardEditorOperation.ToggleBoardEditorUtilityMenu:
                this.toggleUtilityMenu();
                break;
        }
    }

    /**
     * Redraws the board editor and restores its state.
     */
    public drawBoard(): void {
        this.renderComponent();
        this.addEventListeners();
        this.loadLocalStorage();

        const notation = this.chess.getGameAsFenNotation(false);
        this.createBoard(notation);

        this.updateFen();
    }
}
