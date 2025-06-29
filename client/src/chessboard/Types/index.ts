import {
    Color,
    GameStatus,
    JsonNotation,
    Square,
} from '@ChessPlatform/chessboard/Chess/Types';

/**
 * SocketOperation enum for the types
 * of operations that can be done in/by
 * the socket.
 * @see src/ChessPlatform.ts
 */
export enum SocketOperation {
    CreateLobby = 'CreateLobby',
    JoinLobby = 'JoinLobby',
    CancelLobby = 'CancelLobby',
    AbortGame = 'AbortGame',
    Resign = 'Resign',
    SendDrawOffer = 'SendDrawOffer',
    SendUndoOffer = 'SendUndoOffer',
    AcceptDrawOffer = 'AcceptDrawOffer',
    AcceptUndoOffer = 'AcceptUndoOffer',
    SendPlayAgainOffer = 'SendPlayAgainOffer',
    AcceptPlayAgainOffer = 'AcceptPlayAgainOffer',
    DeclineSentOffer = 'DeclineSentOffer',
    CancelOffer = 'CancelOffer',
}

/**
 * SocketEvent enum is used to define the events
 * that are triggered by the ChessPlatform.
 * @enum {string}
 */
export enum SocketEvent {
    /**
     * Triggered when waiting server response
     * to create the lobby.
     * @CustomEvent
     */
    onCreatingLobby = 'onCreatingLobby',

    /**
     * Triggered when the lobby is created successfully.
     * @CustomEvent
     * @param {string} lobbyId - The lobby id.
     */
    onLobbyCreated = 'onLobbyCreated',

    /**
     * Triggered when waiting server response
     * to join the lobby.
     * @CustomEvent
     * @param {string} lobbyId - The lobby id.
     */
    onJoiningLobby = 'onJoiningLobby',

    /**
     * Triggered when the lobby is joined.
     * @Event
     */
    onLobbyJoined = 'onLobbyJoined',

    /**
     * Triggered when the lobby is cancelled.
     * @Event
     */
    onLobbyCancelled = 'onLobbyCancelled',

    /**
     * Triggered when the active connection is closed.
     * @Event
     */
    onConnectionTerminated = 'onConnectionTerminated',
}

/**
 * Player interface for the player data.
 */
export interface Player {
    id: string;
    name: string;
    isOnline: boolean;
    token: string;
}

/**
 * WebSocket command types.
 */
export enum WsTitle {
    Created = 'CREATED',
    Connected = 'CONNECTED',
    Started = 'STARTED',
    Finished = 'FINISHED',
    Disconnected = 'DISCONNECTED',
    Reconnected = 'RECONNECTED',
    Moved = 'MOVED',
    Aborted = 'ABORTED',
    Resigned = 'RESIGNED',
    DrawOffered = 'DRAW_OFFERED',
    DrawAccepted = 'DRAW_ACCEPTED',
    UndoOffered = 'UNDO_OFFERED',
    UndoAccepted = 'UNDO_ACCEPTED',
    PlayAgainOffered = 'PLAY_AGAIN_OFFERED',
    PlayAgainAccepted = 'PLAY_AGAIN_ACCEPTED',
    SentOfferDeclined = 'SENT_OFFER_DECLINED',
    OfferCancelled = 'OFFER_CANCELLED',
    SentOfferCancelled = 'SENT_OFFER_CANCELLED',
    Error = 'ERROR',
}

/**
 * WsCreatedData interface for the
 * created command to receive from the
 * WebSocket.
 */
export interface WsCreatedData {
    lobbyId: string;
    player: Player;
}

/**
 * WsConnectedData interface for the
 * connected command to receive from the
 * WebSocket.
 */
export interface WsConnectedData {
    lobbyId: string;
    player: Player;
}

/**
 * WsStartedData interface for the
 * started command to receive from the
 * WebSocket.
 */
export interface WsStartedData {
    whitePlayer: {
        id: string;
        name: string;
        isOnline: boolean;
    };
    blackPlayer: {
        id: string;
        name: string;
        isOnline: boolean;
    };
    game: string | JsonNotation;
}

/**
 * WsFinishedData interface for the
 * finished command to receive from the
 * WebSocket.
 */
export interface WsFinishedData {
    gameStatus: GameStatus;
}

/**
 * WsResignedData interface for the
 * resigned command to receive from the
 * WebSocket.
 */
export interface WsResignedData {
    gameStatus: GameStatus;
}

/**
 * WsUndoData interface for the
 * undo command to send to the client.
 */
export interface WsUndoData {
    undoColor: Color;
    board: string;
}

/**
 * WsMovedData interface for the
 * moved command to send to the client
 * or receive from the client.
 */
export interface WsMovedData {
    from: Square;
    to: Square;
}

/**
 * WsDisconnectedData interface for the
 * disconnected command to receive from the
 * WebSocket.
 */
export interface WsDisconnectedData {
    lobbyId: string;
    color: Color;
}

/**
 * WsReconnectedData interface for the
 * reconnected command to receive from the
 * WebSocket.
 */
export interface WsReconnectedData {
    lobbyId: string;
    color: Color;
}

/**
 * WsErrorData interface for the
 * error command to receive from the
 * WebSocket.
 */
export interface WsErrorData {
    message: string;
}

/**
 * WsDataUnion type for the data that can be
 * received from the WebSocket.
 */
export type WsDataUnion =
    | WsCreatedData
    | WsConnectedData
    | WsStartedData
    | WsFinishedData
    | WsResignedData
    | WsUndoData
    | WsMovedData
    | WsReconnectedData
    | WsDisconnectedData
    | WsErrorData;

/**
 * WsDataMap type that maps each WebSocket command title (WsTitle)
 * to its corresponding data type.
 */
export type WsDataMap = {
    [WsTitle.Created]: WsCreatedData;
    [WsTitle.Connected]: WsConnectedData;
    [WsTitle.Started]: WsStartedData;
    [WsTitle.Finished]: WsFinishedData;
    [WsTitle.Resigned]: WsResignedData;
    [WsTitle.UndoAccepted]: WsUndoData;
    [WsTitle.UndoOffered]: WsUndoData;
    [WsTitle.Moved]: WsMovedData;
    [WsTitle.Reconnected]: WsReconnectedData;
    [WsTitle.Disconnected]: WsDisconnectedData;
    [WsTitle.Error]: WsErrorData;
};

/**
 * WsData type that retrieves the appropriate data type
 * based on the provided WebSocket command title (WsTitle).
 */
export type WsData<T extends WsTitle> = T extends keyof WsDataMap
    ? WsDataMap[T]
    : never;

/**
 * WsMessage type for the command and data that can be
 * sent to the client or received from the client.
 * @see src/Platform/Platform.ts
 */
export type WsMessage<T extends WsTitle> = [T, WsData<T>];

/**
 * Represents the parameters required to create a
 * new lobby.
 */
export interface CreateLobbyReqParams {
    name: string;
    board: string;
    remaining: string;
    increment: string;
}

/**
 * Represents the parameters required to join a
 * lobby.
 */
export interface JoinLobbyReqParams {
    name: string;
    lobbyId: string;
}

/**
 * Represents the parameters required to reconnect
 * to a lobby.
 */
export interface ReconnectLobbyReqParams {
    lobbyId: string;
    token: string;
}
