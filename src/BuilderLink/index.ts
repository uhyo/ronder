import type { LocationComposer } from "../LocationComposer";
import type { Location } from "../LocationComposer/Location";
import type { RouteRecordType } from "../RouteBuilder/RouteRecord";
import { RouteResolver, SegmentResolver } from "../RouteResolver";
import { PartiallyPartial } from "../util/types/PartiallyPartial";
import {
  AttachableRouteBuilder,
  HasBuilderLink,
} from "./AttachableRouteBuilder";
import type { BuilderLinkOptions } from "./BuilderLinkOptions";
import { BuilderLinkState } from "./BuilderLinkState";
import { fillOptions } from "./fillOptions";

export type RouteRecordsBase<ActionResult> = Record<
  string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RouteRecordType<ActionResult, any, any>
>;

/**
 * Link between parent and child builders.
 */
export class BuilderLink<ActionResult, Segment>
  implements HasBuilderLink<ActionResult, Segment> {
  static init<ActionResult, Segment>(
    options: PartiallyPartial<BuilderLinkOptions<ActionResult, Segment>, "root">
  ): BuilderLink<ActionResult, Segment> {
    fillOptions(options);
    return new BuilderLink<ActionResult, Segment>(options);
  }

  readonly composer: LocationComposer<Segment>;
  #resolver: RouteResolver<ActionResult, Segment>;

  #state: BuilderLinkState<ActionResult, Segment> = {
    state: "unattached",
  };
  /**
   * Registered child builder.
   */
  #childBuilder?: AttachableRouteBuilder<ActionResult, Segment> = undefined;
  resolveSegment?: SegmentResolver<ActionResult, Segment>;
  #rootLocation: Location;

  private constructor(options: BuilderLinkOptions<ActionResult, Segment>) {
    this.composer = options.composer;
    this.#resolver = new RouteResolver(this);
    this.#rootLocation = options.root;
  }

  /**
   * Attach this link to a parent.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attachToParent(parentRoute: RouteRecordType<any, any, any>) {
    // TODO: recover this check
    if (this.#state.state !== "unattached") {
      throw new Error("A builder cannot be attached more than once.");
    }
    this.#state = {
      state: "attached",
      parentRoute,
    };
  }

  /**
   * Follow inheritance chain and run a function at the end.
   */
  private followInheritanceChain<Result>(
    callback: (link: BuilderLink<ActionResult, Segment>) => Result
  ): {
    result: Result;
    last: BuilderLink<ActionResult, Segment>;
  } {
    if (this.#state.state === "inherited") {
      const res = this.#state.inheritor.followInheritanceChain(callback);
      // short-cut optimization
      this.#state = {
        state: "inherited",
        inheritor: res.last,
      };
      return res;
    } else {
      const result = callback(this);
      return {
        result,
        last: this,
      };
    }
  }

  checkInvalidation() {
    if (this.#state.state === "inherited") {
      throw new Error("This BuilderLink is already invalidated.");
    }
  }

  getParentRoute(): RouteRecordType<ActionResult, never, boolean> | undefined {
    return this.followInheritanceChain((link) => link.#state.parentRoute)
      .result;
  }

  getRootLocation(): Location {
    return this.followInheritanceChain((link) => link.#rootLocation).result;
  }

  getBuilderLink(): this {
    return this;
  }

  getChildBuilder(): AttachableRouteBuilder<ActionResult, Segment> | undefined {
    return this.#childBuilder;
  }

  /**
   * TODO: rethink
   */
  register(
    builder: AttachableRouteBuilder<ActionResult, Segment>,
    resolveSegment: SegmentResolver<ActionResult, Segment>
  ): void {
    this.#childBuilder = builder;
    this.resolveSegment = resolveSegment;
  }

  /**
   * Create a new BuilderLink which inherits current link.
   */
  inherit(): BuilderLink<ActionResult, Segment> {
    switch (this.#state.state) {
      case "unattached": {
        const result = new BuilderLink<ActionResult, Segment>({
          composer: this.composer,
          root: this.#rootLocation,
        });
        result.#state = this.#state;
        return result;
      }
      case "attached": {
        const result = new BuilderLink<ActionResult, Segment>({
          composer: this.composer,
          root: this.#rootLocation,
        });
        result.#resolver = this.#resolver;

        this.#state.parentRoute.attach(result);

        this.#state = {
          state: "inherited",
          inheritor: result,
        };
        return result;
      }
      case "inherited": {
        throw new Error("Cannot inherit already invalidated link");
      }
    }
  }
}
