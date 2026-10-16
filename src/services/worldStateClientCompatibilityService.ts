interface IEventWithIcon {
    Icon?: string;
}

const uriScheme = /^[a-z][a-z\d+.-]*:/i;

/** Legacy clients parse Event.Icon as a Lotus scoped name, not a URL. */
export const stripExternalEventIcons = (events: IEventWithIcon[]): void => {
    for (const event of events) {
        if (event.Icon && uriScheme.test(event.Icon)) delete event.Icon;
    }
};
