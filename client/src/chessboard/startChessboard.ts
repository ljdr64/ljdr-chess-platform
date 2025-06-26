import { ChessPlatform } from './ChessPlatform';

let instance: ChessPlatform | null = null;

export function startChessboard() {
    if (!instance) {
        instance = new ChessPlatform();
    } else {
        instance.renderBoardAgain();
    }
}
