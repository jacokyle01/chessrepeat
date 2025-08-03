// file://./../../analyse/src/ctrl.ts

declare namespace Tree {
  export type Path = string;
  export interface NodeBase {
    // file://./../../tree/src/tree.ts
    id: string;
    ply: number;
    // uci?: Uci;
    fen: string;
    comments?: Comment[];
    dests?: string;
    drops?: string | null;
    // check?: Key;
    // threat?: LocalEval;
    forceVariation?: boolean;
    shapes?: Shape[];
    comp?: boolean;
    san?: string;
    threefold?: boolean;
    fail?: boolean;

    // training-specific values 
    disabled: boolean;
    seen: boolean; //TODO combine seen&dueAt
    group: number;
    dueAt: number;
  }
  export interface NodeFromServer extends NodeBase {
    children?: Node[];
  }
  export interface Node extends NodeBase {
    children: Node[];
    collapsed?: boolean;
  }


  export interface Comment {
    id: string;
    by:
      | string
      | {
          id: string;
          name: string;
        };
    text: string;
  }

  export interface Shape {}
}
