// import React, {
//   forwardRef,
//   useEffect,
//   useImperativeHandle,
//   useRef,
//   useState,
// } from 'react';

// import { Chessground as ChessgroundApi } from 'chessground';
// import { Config } from 'chessground/config';
// import { Api } from 'chessground/api';
// import { Key } from 'chessground/types';

// interface Props {
//   width?: number;
//   height?: number;
//   contained?: boolean;
//   config?: Config;
// }

// const Chessboard = forwardRef<Api | undefined, Props>(
//   (
//     { width = 900, height = 900, config = {}, contained = false }: Props,
//     apiRef
//   ) => {
//     const [api, setApi] = useState<Api | undefined>();
//     const divRef = useRef<HTMLDivElement>(null);

//     useImperativeHandle(apiRef, () => api, [api]);

//     useEffect(() => {
//       if (divRef.current) {
//         divRef.current.classList.add('alpha');
//         divRef.current.classList.add('blue');
//         // divRef.current.classList.add('p-3');
//         // divRef.current.classList.add('bg-white');



//         if (!api) {
//           const chessgroundApi = ChessgroundApi(divRef.current, config);
//           setApi(chessgroundApi);
//         }
//       }
//     }, [divRef.current, api]);

//     useEffect(() => {
//       console.log("config in cg", config);
//       if (api) {
//         api.set(config);
//       }
//     }, [config]);

//     return (
//       <div
//         style={{
//           height: contained ? '100%' : height,
//           width: contained ? '100%' : width,
//         }}
//       >
//         <div
//           ref={divRef}
//           style={{ height: '100%', width: '100%', display: 'table' }}
//         />
//       </div>
//     );
//   }
// );

// export type { Api, Config, Key };
// export default Chessboard;

// import { boardImageAtom, moveMethodAtom } from "@/state/atoms";
// import { Box } from "@mantine/core";
import { Box } from "@mantine/core";
import { Chessground as NativeChessground } from "chessground";
import type { Api } from "chessground/api";
import type { Config } from "chessground/config";
import { useAtomValue } from "jotai";
import { useEffect, useRef, useState } from "react";

export function Chessground(
  props: Config & { setBoardFen?: (fen: string) => void },
) {
  const [api, setApi] = useState<Api | null>(null);

  const ref = useRef<HTMLDivElement>(null);

  // const moveMethod = useAtomValue(moveMethodAtom);
  const moveMethod = "both";


  useEffect(() => {
    if (ref?.current == null) return;
    if (api) {
      api.set({
        ...props,
        events: {
          change: () => {
            if (props.setBoardFen && api) {
              props.setBoardFen(api.getFen());
            }
          },
        },
      });
    } else {
      const chessgroundApi = NativeChessground(ref.current, {
        ...props,
        addDimensionsCssVarsTo: ref.current,
        events: {
          change: () => {
            if (props.setBoardFen && chessgroundApi) {
              props.setBoardFen(chessgroundApi.getFen());
            }
          },
        },
        draggable: {
          ...props.draggable,
          // enabled: moveMethod !== "select",
        },
        selectable: {
          ...props.selectable,
          // enabled: moveMethod !== "drag",
        },
      });
      setApi(chessgroundApi);
    }
  }, [api, props, ref]);

  useEffect(() => {
    api?.set({
      ...props,
      events: {
        change: () => {
          if (props.setBoardFen && api) {
            props.setBoardFen(api.getFen());
          }
        },
      },
    });
  }, [api, props]);

  // const boardImage = useAtomValue(boardImageAtom);
//TODO fix off-by-1
//TODO use box component instead?
return (
  <div
    className="alpha blue"
    style={{
      aspectRatio: 1,
      width: "100%",
      backgroundImage: "url('/images/board/blue2.jpg')",
      backgroundSize: "cover",
      backgroundPosition: "center",
    }}
    ref={ref}
  />
);
}
