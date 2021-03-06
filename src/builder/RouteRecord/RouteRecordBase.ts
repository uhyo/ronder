import type { HasBuilderLink } from "../../core/BuilderLink/HasBuilderLink";
import { Location } from "../../core/Location";
import { RouteBuilderLink, RouteBuilderLinkValue } from "../RouteBuilderLink";
import type { ActionType } from "../RoutesDefinitionObject";
import { routeRecordParentKey, routeRecordSegmentGetterKey } from "../symbols";
import { AttachFunction, RouteRecordType } from "./RouteRecordType";

export type ActionTypeOfRouteRecord<
  ActionResult,
  Match,
  HasAction extends boolean
> = HasAction extends true ? ActionType<ActionResult, Match> : undefined;

const defaultRoot: Location = {
  pathname: "/",
  state: null,
};

/**
 * Object for each route provided by RouteBuilder.
 * Should implement RouteRecordType.
 */
export abstract class RouteRecordBase<
  ActionResult,
  Match,
  HasAction extends boolean
> implements RouteRecordType<ActionResult, Match, HasAction> {
  /**
   * Action of this route.
   */
  readonly action: ActionTypeOfRouteRecord<ActionResult, Match, HasAction>;
  readonly [routeRecordParentKey]: RouteBuilderLink<ActionResult, unknown>;

  #builder?: RouteBuilderLink<ActionResult, unknown> = undefined;
  [routeRecordSegmentGetterKey]: (match: Match) => unknown;

  constructor(
    parentLink: RouteBuilderLink<ActionResult, unknown>,
    action: ActionTypeOfRouteRecord<ActionResult, Match, HasAction>,
    segmentGetter: (match: Match) => unknown
  ) {
    this.action = action;
    this[routeRecordSegmentGetterKey] = segmentGetter;
    Object.defineProperty(this, routeRecordParentKey, {
      value: parentLink,
    });

    Object.defineProperty(this, "attach", {
      configurable: true,
      writable: true,
      value(
        this: RouteRecordBase<ActionResult, Match, HasAction>,
        builder: HasBuilderLink<
          ActionResult,
          unknown,
          RouteBuilderLinkValue<ActionResult>
        >
      ) {
        const link = builder.getBuilderLink().getAttachmentRoot();
        this.#builder = link;
        link.attachToParent(
          parentLink,
          segmentGetter as (match: unknown) => unknown
        );
        return builder;
      },
    });
  }

  /**
   * Get the link attached to this Route.
   */
  getAttachedBuilderLink():
    | RouteBuilderLink<ActionResult, unknown>
    | undefined {
    return this.#builder;
  }

  /**
   * Attach given builder as a child of this route.
   */
  readonly attach!: AttachFunction<ActionResult, Match>;
}
