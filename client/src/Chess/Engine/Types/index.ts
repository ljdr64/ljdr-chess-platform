import { Color, PieceType, Square } from '../../Types';

/**
 * @description Piece is used to define a piece.
 * @see src/Models/Piece.ts For more information.
 */
export interface Piece {
    getColor(): Color;
    getType(): PieceType;
    getScore(): number;
}

/**
 * @description Route is used for the store move directions of the pieces.
 * @see src/Engine/Calculator/PathCalculator For more information.
 */
export type Route = {
    [MoveRoute.BottomRight]?: Square[];
    [MoveRoute.Right]?: Square[];
    [MoveRoute.TopRight]?: Square[];
    [MoveRoute.Top]?: Square[];
    [MoveRoute.TopLeft]?: Square[];
    [MoveRoute.Left]?: Square[];
    [MoveRoute.BottomLeft]?: Square[];
    [MoveRoute.Bottom]?: Square[];
    [MoveRoute.L]?: Square[];
};

/**
 * @description MoveRoute enum for the route of the move.
 * @see src/Engine/Calculator/PathCalculator For more information.
 */
export enum MoveRoute {
    BottomLeft = 'BottomLeft',
    BottomRight = 'BottomRight',
    TopLeft = 'TopLeft',
    TopRight = 'TopRight',
    Left = 'Left',
    Right = 'Right',
    Top = 'Top',
    Bottom = 'Bottom',
    L = 'L',
}

/**
 * @description NotationSymbol enum for the notation symbols.
 * @see src/Engine/ChessEngine For more information.
 */
export enum NotationSymbol {
    Capture = 'x',
    Check = '+',
    Checkmate = '#',
    Promotion = '=',
    Draw = '1/2-1/2',
    ShortCastling = 'O-O',
    LongCastling = 'O-O-O',
}
