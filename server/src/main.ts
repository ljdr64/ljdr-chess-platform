/**
 * @name Chess
 * @description Server side of the chess application.
 * @version 1.0.0
 * @author Berkay Kaya <berkaykayaforbusiness@outlook.com> (https://bberkay.github.io)
 * @url https://github.com/bberkay/chess
 * @license MIT
 */

/**
 * ********* Websocket Connection Rules ***********
 *
 * Creating Lobby:
 * ws://localhost:3000?name=Player1&board=pppppppprnbqkbnr/8/8/8/8/8/PPPPPPPPRNBQKBNR%20w%20KQkq%20-%200%201&totalTime=5&incrementTime=0
 * lobbyId and token will be created randomly by server
 * and sent to client with connected WsCommand. Example:
 * CONNECTED JSON.stringify({
 *  "lobbyId":"123456",
 *  "token":"123456",
 *  "color":"White",
 *  "name":"Player1"
 * })
 *
 * Connection to the lobby:
 * ws://localhost:3000?name=Player1&lobbyId=123456
 * token will be created randomly by server and sent to
 * client with connected WsCommand.
 *
 * Reconneting to the lobby:
 * ws://localhost:3000?token=123456&lobbyId=123456
 * name will be taken from the server by token
 * and sent to client with connected WsCommand.
 * Note: name will be taken from the server
 * by token for preventing the user to reconnect
 * lobby with different name.
 *
 * *************************************************
 */

import type { Server } from 'bun';
import type {
    CreateLobbyReqParams,
    JoinLobbyReqParams,
    ReconnectLobbyReqParams,
    RWebSocket,
    WebSocketData,
    WebSocketReqParams,
    BaseWebSocketReqParams,
    Player,
} from './Types';
import {
    WsTitle,
    WsData,
    WsConnectedData,
    WsCreatedData,
    WsStartedData,
    WsFinishedData,
    WsResignedData,
    WsUndoData,
    WsMovedData,
    WsDisconnectedData,
    WsReconnectedData,
    WsErrorData,
} from './Types';
import type { Square } from '@Chess/Types';
import { Color } from '@Chess/Types';
import { LobbyManager } from './Managers/LobbyManager';
import {
    createRandomId,
    isValidLength,
    isInRange,
    updateKeys,
} from './Utils/Helper';
import {
    CORS_HEADERS,
    MAX_IDLE_TIMEOUT,
    MAX_PAYLOAD_LENGTH,
    SERVER_PORT,
} from './Consts';
import {
    GU_ID_LENGTH,
    MAX_PLAYER_NAME_LENGTH,
    MIN_PLAYER_NAME_LENGTH,
    MAX_TOTAL_TIME,
    MIN_TOTAL_TIME,
    MAX_INCREMENT_TIME,
    MIN_INCREMENT_TIME,
} from './Consts';
import { SocketManager } from './Managers/SocketManager';
import { Lobby } from './Lobby';

/**
 * Validates individual parameters of a WebSocket request.
 */
function validate(params: BaseWebSocketReqParams): Response | boolean {
    const validations: Record<string, boolean> = {
        name:
            params.name === '' ||
            isInRange(
                params.name.length,
                MIN_PLAYER_NAME_LENGTH,
                MAX_PLAYER_NAME_LENGTH,
            ),
        lobbyId:
            params.lobbyId === '' ||
            (isValidLength(params.lobbyId, GU_ID_LENGTH) &&
                LobbyManager.isLobbyExist(params.lobbyId)),
        token: params.token === '' || isValidLength(params.token, GU_ID_LENGTH),
        board: params.board === '' || params.board.length <= 100,
        remaining:
            params.remaining === '' ||
            isInRange(
                parseInt(params.remaining as string),
                MIN_TOTAL_TIME,
                MAX_TOTAL_TIME,
            ),
        increment:
            params.increment === '' ||
            isInRange(
                parseInt(params.increment as string),
                MIN_INCREMENT_TIME,
                MAX_INCREMENT_TIME,
            ),
    };
    console.log('Validations: ', validations);

    const errors: Record<string, string> = {
        name: `Invalid request. "playerName" length must be between ${MIN_PLAYER_NAME_LENGTH} and ${MAX_PLAYER_NAME_LENGTH}.`,
        lobbyId: `Invalid request. "lobbyId" length must be ${GU_ID_LENGTH} length and lobby must be exist.`,
        token: `Invalid request. "token" length must be ${GU_ID_LENGTH}.`,
        board: `Invalid request. "board" length must be less than 100.`,
        remaining: `Invalid request. "remaining" must be a number between ${MIN_TOTAL_TIME} and ${MAX_TOTAL_TIME}.`,
        increment: `Invalid request. "increment" must be a number between ${MIN_INCREMENT_TIME} and ${MAX_INCREMENT_TIME}.`,
    };

    for (const key in validations) {
        if (!validations[key])
            return new Response(errors[key], { status: 400 });
    }

    return true;
}

/**
 * Ensures that certain parameters are not used
 * together and that required combinations are
 * present.
 */
function validateCombination(
    params: BaseWebSocketReqParams,
): Response | boolean {
    if (params.name && params.token)
        return new Response(
            `Invalid request. "name" and "token" cannot be used together.`,
            { status: 400 },
        );

    if (!params.name && !params.token)
        return new Response(
            `Invalid request. "name" or "token" must be provided.`,
            { status: 400 },
        );

    if (params.token && !params.lobbyId)
        return new Response(
            `Invalid request. "token" must be used with "lobbyId".`,
            { status: 400 },
        );

    if (
        (params.board || params.remaining || params.increment) &&
        (!params.name || params.lobbyId || params.token)
    )
        return new Response(
            `Invalid request. "board", "remaining", "increment" can only be used when creating a new lobby.`,
            { status: 400 },
        );

    if (
        params.name &&
        !params.lobbyId &&
        (!params.board || !params.remaining || !params.increment)
    )
        return new Response(
            `Invalid request. "board", "remaining", "increment" must be provided when creating a new lobby.`,
            { status: 400 },
        );

    return true;
}

/**
 * Determines the specific type of WebSocket request
 * based on the provided parameters.
 */
function findWebSocketReqParams(
    params: BaseWebSocketReqParams,
): Response | WebSocketReqParams {
    if (params.name && params.board && params.remaining && params.increment)
        return {
            name: params.name,
            board: params.board,
            remaining: params.remaining,
            increment: params.increment,
        } as CreateLobbyReqParams;

    if (params.name && params.lobbyId)
        return {
            name: params.name,
            lobbyId: params.lobbyId,
        } as JoinLobbyReqParams;

    if (params.token && params.lobbyId)
        return {
            token: params.token,
            lobbyId: params.lobbyId,
        } as ReconnectLobbyReqParams;

    return new Response('Invalid request.', { status: 400 });
}

/**
 * This function combines individual parameter validation,
 * combination validation, and request type determination.
 */
function isParametersValid(req: Request): Response | WebSocketReqParams {
    const url = new URL(req.url);
    const params: BaseWebSocketReqParams = {
        name: url.searchParams.get('name') || '',
        lobbyId: url.searchParams.get('lobbyId') || '',
        token: url.searchParams.get('token') || '',
        board: url.searchParams.get('board') || '',
        remaining: url.searchParams.get('remaining') || '',
        increment: url.searchParams.get('increment') || '',
    };
    console.log('Params: ', JSON.stringify(params));
    let validation = validate(params);
    if (validation instanceof Response) return validation;

    validation = validateCombination(params);
    if (validation instanceof Response) return validation;

    const webSocketReqParams = findWebSocketReqParams(params);
    if (webSocketReqParams instanceof Response) return webSocketReqParams;

    return webSocketReqParams;
}

/**
 * Parse the needed data for the creating of the lobby.
 */
function createLobbyAndGetLobbyJoiningData(
    createLobbyReqParams: CreateLobbyReqParams,
): Response | { lobbyId: string; token: string } {
    const lobbyId = LobbyManager.createLobby(createLobbyReqParams.board, {
        remaining:
            typeof createLobbyReqParams.remaining === 'string'
                ? parseInt(createLobbyReqParams.remaining)
                : createLobbyReqParams.remaining,
        increment:
            typeof createLobbyReqParams.increment === 'string'
                ? parseInt(createLobbyReqParams.increment)
                : createLobbyReqParams.increment,
    });

    return { lobbyId, token: createRandomId(GU_ID_LENGTH) };
}

/**
 * Parse the needed data for the joining to the lobby.
 */
function getLobbyJoiningData(
    joinLobbyReqParams: JoinLobbyReqParams,
): Response | { lobbyId: string; token: string } {
    const lobby = LobbyManager.getLobby(joinLobbyReqParams.lobbyId);
    if (!lobby) return new Response('Lobby not found.', { status: 404 });

    if (lobby.isGameStarted())
        return new Response('Lobby is already started to play.', {
            status: 400,
        });

    return {
        lobbyId: joinLobbyReqParams.lobbyId,
        token: createRandomId(
            GU_ID_LENGTH,
            lobby.getWhitePlayer()?.token || lobby.getBlackPlayer()?.token,
        ),
    };
}

/**
 * Parse the needed data for the reconnecting to the lobby.
 */
function getReconnectingLobbyData(
    reconnectLobbyReqParams: ReconnectLobbyReqParams,
): Response | { lobbyId: string; name: string; id: string } {
    const lobby = LobbyManager.getLobby(reconnectLobbyReqParams.lobbyId);
    if (!lobby) return new Response('Lobby not found.', { status: 404 });

    const name = lobby.getTokenName(reconnectLobbyReqParams.token);
    const id = lobby.getTokenId(reconnectLobbyReqParams.token);
    if (!name || !id)
        return new Response('Invalid user token.', { status: 401 });
    if (lobby.isTokenOnline(reconnectLobbyReqParams.token))
        return new Response('User is already online.', { status: 400 });

    return { lobbyId: reconnectLobbyReqParams.lobbyId, name, id };
}

/**
 * Handles the incoming WebSocket request parameters.
 * This function handles the entire process of validating and
 * processing the request parameters.
 */
function handleParameters(
    req: Request,
): Response | { lobbyId: string; token: string; name: string; id?: string } {
    // Check if the parameters are valid.
    const params = isParametersValid(req);
    if (params instanceof Response) return params;

    let neededParams = updateKeys({ lobbyId: '', token: '', name: '' }, params);
    if ((params as CreateLobbyReqParams).board !== undefined)
        neededParams = updateKeys(
            neededParams,
            createLobbyAndGetLobbyJoiningData(params as CreateLobbyReqParams),
        );
    else if ((params as ReconnectLobbyReqParams).token !== undefined)
        neededParams = updateKeys(
            neededParams,
            getReconnectingLobbyData(params as ReconnectLobbyReqParams),
        );
    else if ((params as JoinLobbyReqParams).lobbyId !== undefined)
        neededParams = updateKeys(
            neededParams,
            getLobbyJoiningData(params as JoinLobbyReqParams),
        );

    return neededParams as {
        lobbyId: string;
        token: string;
        name: string;
        id?: string;
    };
}

/**
 * Handles HTTP requests to the server.
 * This function processes GET requests and provides appropriate responses.
 */
function handleHttpRequest(req: Request): CORSResponse {
    if (req.method !== 'GET')
        return new CORSResponse('Only GET method is allowed.', { status: 405 });

    if (req.url === '/')
        return new CORSResponse('Chess server is running.', { status: 200 });

    const url = new URL(req.url);

    // Parameters:
    if (url.searchParams.has('lobbyId')) {
        const lobbyId = url.searchParams.get('lobbyId') as string;
        if (LobbyManager.isLobbyExist(lobbyId)) {
            return new CORSResponse('Lobby is exist.', { status: 200 });
        } else {
            return new CORSResponse('Lobby not found.', { status: 404 });
        }
    }

    return new CORSResponse('Invalid request.', { status: 400 });
}

/**
 * Response class with CORS headers.
 */
class CORSResponse extends Response {
    constructor(body: BodyInit | null, init?: ResponseInit) {
        super(body, init);
        for (const key in CORS_HEADERS) {
            this.headers.set(key, CORS_HEADERS[key]);
        }
    }
}

/**
 * Check if the request is a websocket request.
 */
function isWebSocketRequest(req: Request): boolean {
    return req.headers.get('upgrade') === 'websocket';
}

/**
 * Check if the request is a http request.
 */
function isHttpRequest(req: Request): boolean {
    return req.headers.get('upgrade') === null;
}

/**
 * Server instance.
 */
const server = Bun.serve<WebSocketData>({
    port: SERVER_PORT,
    fetch(req: Request, server: Server) {
        if (isHttpRequest(req)) return handleHttpRequest(req);

        if (!isWebSocketRequest(req))
            return new CORSResponse(
                'Only websocket or http GET requests are allowed.',
                { status: 400 },
            );

        // Handle the parameters and get
        // lobbyId and (token or name).
        let params: {
            lobbyId: string;
            token: string;
            name: string;
            id?: string;
        };
        try {
            const handlingResponse = handleParameters(req);
            if (handlingResponse instanceof Response) return handlingResponse;
            params = handlingResponse;
        } catch (e: unknown) {
            return new Response(
                e instanceof Error
                    ? e.message
                    : 'An error occured while handling the parameters.',
                { status: 500 },
            );
        }

        const { lobbyId, token, name, id } = params;

        // upgrade the connection.
        const success = server.upgrade(req, {
            data: {
                lobbyId: lobbyId,
                player: {
                    name: name,
                    token: token,
                    id: id,
                    isOnline: true,
                },
            },
        });
        if (success) return;

        return undefined;
    },
    websocket: {
        open(ws: RWebSocket) {
            try {
                joinLobby(ws);
            } catch (e: unknown) {
                ws.send(
                    WsCommand.error({
                        message:
                            e instanceof Error
                                ? e.message
                                : 'An unexpected error occured while opening the websocket connection.',
                    }),
                );
            }
        },
        message(ws: RWebSocket, message: string) {
            try {
                console.log('Ws:', ws.data.player.name, 'Message: ', message);
                if (
                    SocketManager.getSocket(
                        ws.data.lobbyId,
                        ws.data.player.token,
                    ) === ws
                )
                    handleMessage(ws, message);
            } catch (e: unknown) {
                ws.send(
                    WsCommand.error({
                        message:
                            e instanceof Error
                                ? e.message
                                : 'An unexpected error occured while handling the websocket message.',
                    }),
                );
            }
        },
        close(ws: RWebSocket) {
            try {
                if (
                    SocketManager.getSocket(
                        ws.data.lobbyId,
                        ws.data.player.token,
                    ) === ws
                )
                    leaveLobby(ws);
            } catch (e: unknown) {
                ws.send(
                    WsCommand.error({
                        message:
                            e instanceof Error
                                ? e.message
                                : 'An unexpected error occured while handling the websocket message.',
                    }),
                );
            }
        },
        maxPayloadLength: MAX_PAYLOAD_LENGTH,
        idleTimeout: MAX_IDLE_TIMEOUT,
    },
});

console.log(`Listening on http://localhost:${server.port} ...`);

/**
 * Join the lobby and start the game if the lobby is ready.
 * Send connected command to the client.
 */
function joinLobby(ws: RWebSocket): void {
    const lobbyId = ws.data.lobbyId;
    const player = ws.data.player;

    let isLobbyJustCreated = false;
    const lobby = LobbyManager.getLobby(lobbyId);
    if (!lobby) {
        ws.send(WsCommand.error({ message: 'Lobby not found.' }));
        return;
    }
    isLobbyJustCreated = !lobby.isBothPlayersOnline() && !lobby.isGameStarted();
    console.log('Is Lobby Just Created: ', isLobbyJustCreated);
    if (LobbyManager.joinLobby(lobbyId, player)) {
        console.log('Connection opened: ', lobbyId, player.name);
        ws.subscribe(lobbyId);
        ws.send(
            isLobbyJustCreated
                ? WsCommand.created({ lobbyId, player })
                : WsCommand.connected({ lobbyId, player }),
        );
        SocketManager.addSocket(ws.data.lobbyId, ws.data.player.token, ws);
        if (lobby.isBothPlayersOnline() || lobby.isGameReallyStarted())
            startGame(lobby!);
    } else {
        console.log('Joining the lobby failed: ', lobbyId, player);
    }
}

/**
 * Leave the lobby and send disconnected command to the client.
 */
function leaveLobby(ws: RWebSocket): void {
    const player = ws.data.player;
    const lobby = LobbyManager.getLobby(ws.data.lobbyId);
    if (!lobby) return;

    const color = lobby.getTokenColor(player.token) as Color;
    ws.unsubscribe(lobby.id);
    SocketManager.removeSocket(lobby.id, player.token);
    if (!LobbyManager.leaveLobby(lobby.id, player)) return;

    server.publish(
        lobby.id,
        WsCommand.disconnected({
            lobbyId: lobby.id,
            color: color,
        }),
    );

    console.log('Connection closed: ', lobby.id, player.name);
    LobbyManager.deleteLobbyIfDead(lobby.id);
}

/**
 * Start the game of the given lobby id if
 * it is ready.
 */
function startGame(lobby: Lobby): void {
    const isGameReadyToStart = lobby.isGameReadyToStart();
    const isGameAlreadyStarted = lobby.isGameStarted();
    if (isGameReadyToStart) {
        // Both players are online and the game is not started yet.
        console.log('Starting the game: ', lobby.id);

        // Start the game and send the started command to the clients.
        lobby.startGame();

        const whitePlayer = lobby.getWhitePlayer()!;
        const blackPlayer = lobby.getBlackPlayer()!;

        server.publish(
            lobby.id,
            WsCommand.started({
                whitePlayer: {
                    id: whitePlayer.id,
                    name: whitePlayer.name,
                    isOnline: whitePlayer.isOnline,
                },
                blackPlayer: {
                    id: blackPlayer.id,
                    name: blackPlayer.name,
                    isOnline: blackPlayer.isOnline,
                },
                game: lobby.getGameAsJsonNotation(),
            } as WsStartedData),
        );

        monitorGameTimeExpiration(lobby);
    } else if (isGameAlreadyStarted) {
        // One of the players is should be reconnected to the game.
        // send current board and durations to the reconnected player.
        console.log('Reconnecting player to the game: ', lobby.id);

        // Send the current game to the reconnected
        //yplayer.
        const reconnectedPlayer = lobby.getLastConnectedPlayer();
        if (!reconnectedPlayer) return;

        const reconnectedPlayerWs = SocketManager.getSocket(
            lobby.id,
            reconnectedPlayer.token,
        )!;
        if (!reconnectedPlayerWs) return;

        const whitePlayer = lobby.getWhitePlayer()!;
        const blackPlayer = lobby.getBlackPlayer()!;

        reconnectedPlayerWs.send(
            WsCommand.started({
                whitePlayer: {
                    id: whitePlayer.id,
                    name: whitePlayer.name,
                    isOnline: whitePlayer.isOnline,
                },
                blackPlayer: {
                    id: blackPlayer.id,
                    name: blackPlayer.name,
                    isOnline: blackPlayer.isOnline,
                },
                game: lobby.getGameAsJsonNotation(),
            } as WsStartedData),
        );

        if (lobby.isGameFinished()) {
            reconnectedPlayerWs.send(
                WsCommand.finished({
                    gameStatus: lobby.getGameStatus(),
                }),
            );
        }

        // Send reconnected player's color to the
        // opponent player.
        const reconnectedPlayerColor =
            lobby.getLastConnectedPlayerColor() as Color;
        const opponentPlayer =
            reconnectedPlayerColor === Color.White
                ? lobby.getBlackPlayer()
                : lobby.getWhitePlayer();
        if (!opponentPlayer) return;

        const opponentPlayerWs = SocketManager.getSocket(
            lobby.id,
            opponentPlayer.token,
        )!;
        if (!opponentPlayerWs) return;

        opponentPlayerWs.send(
            WsCommand.reconnected({
                lobbyId: lobby.id,
                color: reconnectedPlayerColor,
            }),
        );
    }
}

/**
 * Monitor and check if the game is finished because
 * one of the players' time has expired.
 */
function monitorGameTimeExpiration(lobby: Lobby): void {
    const interval = setInterval(() => {
        if (lobby.isGameFinished()) {
            finishGame(lobby);
        }
    }, 1000);

    lobby.setGameTimeMonitorInterval(interval as unknown as number);
}

/**
 * Handle the messages from the client.
 */
function handleMessage(ws: RWebSocket, message: string): void {
    const [command, data] = WsCommand.parse(message);
    if (!command) return;

    const lobby = LobbyManager.getLobby(ws.data.lobbyId);
    const player = ws.data.player;
    if (
        !lobby ||
        !lobby.canPlayerParticipate(
            player,
            ![
                WsTitle.PlayAgainOffered,
                WsTitle.PlayAgainAccepted,
                WsTitle.OfferCancelled,
                WsTitle.SentOfferCancelled,
                WsTitle.SentOfferDeclined,
            ].includes(command),
        )
    )
        return;

    try {
        switch (command) {
            case WsTitle.Moved:
                movePiece(
                    lobby,
                    player,
                    (data as WsMovedData).from,
                    (data as WsMovedData).to,
                );
                break;
            case WsTitle.Resigned:
                resign(lobby, player);
                break;
            case WsTitle.DrawOffered:
                offerDraw(lobby, player);
                break;
            case WsTitle.DrawAccepted:
                draw(lobby);
                break;
            case WsTitle.UndoOffered:
                offerUndo(lobby, player);
                break;
            case WsTitle.UndoAccepted:
                undo(lobby);
                break;
            case WsTitle.Aborted:
                abort(lobby);
                break;
            case WsTitle.PlayAgainOffered:
                offerPlayAgain(lobby, player);
                break;
            case WsTitle.PlayAgainAccepted:
                playAgain(lobby);
                break;
            case WsTitle.OfferCancelled:
                cancelOffer(lobby, player);
                break;
            case WsTitle.SentOfferDeclined:
                declineSentOffer(lobby, player);
                break;
        }
    } catch (e: unknown) {
        ws.send(
            WsCommand.error({
                message:
                    e instanceof Error
                        ? e.message
                        : `An error occured while processing the ${command}.`,
            }),
        );
        return;
    }
}

/**
 * Move the piece on the board as the player wants
 * then send to the other player.
 */
function movePiece(
    lobby: Lobby,
    player: Player,
    from: Square,
    to: Square,
): void {
    if (lobby.canPlayerMakeMove(player)) {
        lobby.makeMove(from, to);

        const playerColor = lobby.getTokenColor(player.token) as Color;
        const opponentPlayer =
            playerColor === Color.White
                ? lobby.getBlackPlayer()
                : lobby.getWhitePlayer();
        if (!opponentPlayer) return;

        const opponentPlayerWs = SocketManager.getSocket(
            lobby.id,
            opponentPlayer.token,
        )!;
        if (!opponentPlayerWs) return;

        opponentPlayerWs.send(WsCommand.moved({ from, to }));
        if (lobby.isGameFinished()) finishGame(lobby);
    }
}

/**
 * Offer play again to the opponent player.
 */
function offerPlayAgain(lobby: Lobby, player: Player): void {
    _offer(lobby, player, WsCommand.playAgainOffered);
}

/**
 * Offer draw to the opponent player.
 */
function offerDraw(lobby: Lobby, player: Player): void {
    _offer(lobby, player, WsCommand.drawOffered);
}

/**
 * Offer undo to the opponent player.
 */
function offerUndo(lobby: Lobby, player: Player): void {
    _offer(lobby, player, WsCommand.undoOffered);
    lobby.setCurrentUndoOffer(lobby.getTokenColor(player.token) as Color);
}

/**
 * Cancel the offer and send the offer cancelled command to the client.
 */
function cancelOffer(lobby: Lobby, player: Player): void {
    _offer(lobby, player, WsCommand.sentOfferCancelled);
    lobby.disableOfferCooldown();
}

/**
 * Decline the sent offer and send the declined command to the client.
 */
function declineSentOffer(lobby: Lobby, player: Player): void {
    _offer(lobby, player, WsCommand.sentOfferDeclined);
    lobby.disableOfferCooldown();
}

/**
 * Offer to the opponent player.
 * @param {WsCommand.function} offer WsCommand function to send the offer
 * like WsCommand.playAgainOffered or WsCommand.drawOffered.
 */
function _offer(lobby: Lobby, player: Player, offer: () => string): void {
    const playerColor = lobby.getTokenColor(player.token) as Color;
    const opponentPlayer =
        playerColor === Color.White
            ? lobby.getBlackPlayer()
            : lobby.getWhitePlayer();
    if (!opponentPlayer) return;

    const opponentPlayerWs = SocketManager.getSocket(
        lobby.id,
        opponentPlayer.token,
    )!;
    if (!opponentPlayerWs) return;

    opponentPlayerWs.send(offer());
    lobby.enableOfferCooldown();
}

/**
 * Accept the play again offer and send the started command to the client.
 */
function playAgain(lobby: Lobby): void {
    startGame(lobby);
}

/**
 * Resign the game and send the resigned command to
 * the client.
 */
function resign(lobby: Lobby, player: Player): void {
    lobby.clearGameTimeMonitorInterval();
    lobby.resign(player);
    server.publish(
        lobby.id,
        WsCommand.resigned({
            gameStatus: lobby.getGameStatus(),
        }),
    );
    lobby.finishGame();
}

/**
 * Abort the game and send the aborted command to
 * the client.
 */
function abort(lobby: Lobby): void {
    lobby.clearGameTimeMonitorInterval();
    lobby.draw();
    server.publish(lobby.id, WsCommand.aborted());
    lobby.finishGame();
}

/**
 * Accept and handle the draw offer and send the
 * finished command to the client.
 */
function draw(lobby: Lobby): void {
    lobby.clearGameTimeMonitorInterval();
    lobby.draw();
    server.publish(lobby.id, WsCommand.drawAccepted());
    lobby.finishGame();
}

/**
 * Accept and handle the undo offer and send the
 * undo accepted command to the client.
 */
function undo(lobby: Lobby): void {
    lobby.undo();
    server.publish(
        lobby.id,
        WsCommand.undoAccepted({
            board: lobby.getGameAsFenNotation(),
            undoColor: lobby.getCurrentUndoOffer() as Color,
        }),
    );
}

/**
 * Finish the game and send the finished command
 * to the client.
 */
function finishGame(lobby: Lobby): void {
    lobby.clearGameTimeMonitorInterval();
    server.publish(
        lobby.id,
        WsCommand.finished({
            gameStatus: lobby.getGameStatus(),
        }),
    );
    lobby.finishGame();
}

/**
 * This class is used to create WebSocket commands
 * to send to the client.
 */
class WsCommand {
    /**
     * Create a WebSocket command with the given command and data.
     * @example [Moved, {from: Square.a2, to: Square.a4}]
     * @example [Resigned]
     */
    private static _wsCommand<T extends WsTitle>(
        title: T,
        data: WsData<T> | null = null,
    ): string {
        if (Object.values(WsTitle).indexOf(title) === -1)
            throw new Error('Invalid command.');

        return data ? JSON.stringify([title, data]) : JSON.stringify([title]);
    }

    /**
     * Send created command to the client.
     * @example [Connected, {lobbyId: "1234", player: {name: "Player1", color: "white"}}]
     */
    static created(createdData: WsCreatedData): string {
        return WsCommand._wsCommand(WsTitle.Created, createdData);
    }

    /**
     * Send connected command to the client.
     * @example [Connected, {lobbyId: "1234", player: {name: "Player1", color: "white"}}]
     */
    static connected(connectedData: WsConnectedData): string {
        return WsCommand._wsCommand(WsTitle.Connected, connectedData);
    }

    /**
     * Send started command to the client.
     * @example [STARTED, {board: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR", ...}]
     */
    static started(startedData: WsStartedData): string {
        return WsCommand._wsCommand(WsTitle.Started, startedData);
    }

    /**
     * Send finished command to the client.
     * @example [FINISHED, {gameStatus: GameStatus.Draw}]
     */
    static finished(finishedData: WsFinishedData): string {
        return WsCommand._wsCommand(WsTitle.Finished, finishedData);
    }

    /**
     * Send moved command to the client.
     * @example [MOVED, {from: Square.a2, to: Square.a4}]
     */
    static moved(moveData: WsMovedData): string {
        return WsCommand._wsCommand(WsTitle.Moved, moveData);
    }

    /**
     * Send aborted command to the client.
     */
    static aborted(): string {
        return WsCommand._wsCommand(WsTitle.Aborted);
    }

    /**
     * Send resigned command to the client.
     */
    static resigned(resignedData: WsResignedData): string {
        return WsCommand._wsCommand(WsTitle.Resigned, resignedData);
    }

    /**
     * Send draw accepted command to the client.
     * @example [DRAW_ACCEPTED]
     */
    static drawAccepted(): string {
        return WsCommand._wsCommand(WsTitle.DrawAccepted);
    }

    /**
     * Send undo accepted command to the client.
     * @example [UNDO_ACCEPTED, {board: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR", ...}]
     */
    static undoAccepted(undoData: WsUndoData): string {
        return WsCommand._wsCommand(WsTitle.UndoAccepted, undoData);
    }

    /**
     * Send draw offered command to the client.
     */
    static drawOffered(): string {
        return WsCommand._wsCommand(WsTitle.DrawOffered);
    }

    /**
     * Send undo offered command to the client.
     */
    static undoOffered(): string {
        return WsCommand._wsCommand(WsTitle.UndoOffered);
    }

    /**
     * Send play again offered command to the server.
     */
    static playAgainOffered(): string {
        return WsCommand._wsCommand(WsTitle.PlayAgainOffered);
    }

    /**
     * Send sent offer cancelled command to the client.
     */
    static sentOfferCancelled(): string {
        return WsCommand._wsCommand(WsTitle.SentOfferCancelled);
    }

    /**
     * Send offer declined command to the client.
     */
    static sentOfferDeclined(): string {
        return WsCommand._wsCommand(WsTitle.SentOfferDeclined);
    }

    /**
     * Send disconnected command to the client.
     * @example [DISCONNECTED, {lobbyId: "1234", player: {name: "Player1", color: "white"}}]
     */
    static disconnected(disconnectedData: WsDisconnectedData): string {
        return WsCommand._wsCommand(WsTitle.Disconnected, disconnectedData);
    }

    /**
     * Send reconnected command to the client.
     * @example [RECONNECTED, {lobbyId: "1234", player: {name: "Player1", color: "white"}}]
     */
    static reconnected(reconnectData: WsReconnectedData): string {
        return WsCommand._wsCommand(WsTitle.Reconnected, reconnectData);
    }

    /**
     * Send error command to the client.
     * @example [ERROR, {message: "Invalid move."}]
     */
    static error(errorData: WsErrorData): string {
        return WsCommand._wsCommand(WsTitle.Error, errorData);
    }

    /**
     * Parse the websocket message from the server.
     * @param message "[Moved, {from: Square.a2, to: Square.a4}]"
     * @example [Moved, {from: Square.a2, to: Square.a4}]
     */
    static parse<T extends WsTitle>(message: string): [T, WsData<T>] {
        try {
            return JSON.parse(message) as [T, WsData<T>];
        } catch (error: unknown) {
            throw new Error(
                'Invalid WebSocket message, the message could not be parsed: ' +
                    (error instanceof Error ? error.message : ''),
            );
        }
    }
}
