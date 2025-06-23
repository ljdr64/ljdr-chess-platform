import { Square } from '@ChessPlatform/chessboard/Chess/Types';

/**
 * Board with moves and expectation
 */
export interface TestGame {
    title: string;
    board: string;
    moves?: Array<{ from: Square; to: Square }>;
    expectation: any;
}
