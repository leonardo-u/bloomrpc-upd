/**
 * Renderer-side initialisation for protobufjs + @grpc/grpc-js compatibility.
 *
 * Root cause: protobufjs detects the Node `Buffer` class via
 * `@protobufjs/inquire`, which uses a dynamic `require()` that webpack cannot
 * resolve statically. In a webpack bundle the inquire call returns null, so
 * protobufjs sets `util.Buffer = null` and falls back to its plain `Writer`
 * which produces `Uint8Array` outputs. @grpc/grpc-js's IdentityHandler then
 * calls `message.copy(output, 5)` on that Uint8Array, throws
 * `TypeError: message.copy is not a function`, which is caught upstream and
 * surfaced as `cancelWithStatus(undefined, undefined)` — producing the
 * famous `"undefined undefined: undefined"` user-visible error on every call.
 *
 * Fix: wire the real `Buffer` into protobufjs and re-run its configure step
 * so the `Writer` factory binds to `BufferWriter`, which emits Node `Buffer`
 * instances (which have `.copy()`).
 */
import * as protobuf from 'protobufjs';

let configured = false;

export function ensureGrpcRuntimePatched() {
  if (configured) {
    return;
  }
  try {
    const pb: any = protobuf as any;
    if (typeof Buffer !== 'undefined') {
      pb.util.Buffer = Buffer;
      if (typeof pb.util._configure === 'function') {
        pb.util._configure();
      }
      // Rebind Writer.create() to BufferWriter now that Buffer is known.
      if (pb.Writer && typeof pb.Writer._configure === 'function' && pb.BufferWriter) {
        pb.Writer._configure(pb.BufferWriter);
      }
      if (pb.Reader && typeof pb.Reader._configure === 'function' && pb.BufferReader) {
        pb.Reader._configure(pb.BufferReader);
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to wire Buffer into protobufjs', e);
  }
  configured = true;
}
