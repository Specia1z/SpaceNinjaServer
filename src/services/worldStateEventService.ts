import type { IWorldState } from "../types/worldStateTypes.ts";

export const localizeWorldStateEvents = (
    events: IWorldState["Events"],
    language: string
): IWorldState["Events"] =>
    events.flatMap(event => {
        const localizedMessage =
            event.Messages.find(message => message.LanguageCode == language) ??
            event.Messages.find(message => message.LanguageCode == "en");
        const message = localizedMessage?.Message ?? event.Msg;
        if (!message) {
            return [];
        }

        const localizedLink =
            event.Links?.find(link => link.LanguageCode == localizedMessage?.LanguageCode)?.Link ??
            event.Links?.find(link => link.LanguageCode == language)?.Link ??
            event.Links?.find(link => link.LanguageCode == "en")?.Link;
        const localizedEvent = {
            ...event,
            Messages: [{ Message: message }],
            Prop: localizedLink ?? event.Prop
        };
        delete localizedEvent.Links;
        return [localizedEvent];
    });
