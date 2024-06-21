import { APIUser, APIInteractionGuildMember, APIChatInputApplicationCommandInteraction, LocaleString, APIInteractionDataResolvedGuildMember, APIRole, APIInteractionDataResolvedChannel, APIMessage, APIAttachment, APIChatInputApplicationCommandInteractionData, APIApplicationCommandInteractionDataOption, APIApplicationCommandInteractionDataBasicOption, APIContextMenuInteraction, APIContextMenuInteractionData, APIApplicationCommandOption } from 'discord-api-types/v10';
import { SnowTransfer } from 'snowtransfer';

declare class ChatInputCommand {
    author: APIUser;
    member: APIInteractionGuildMember | null;
    guild_id: string | null;
    channel: APIChatInputApplicationCommandInteraction["channel"];
    locale: LocaleString;
    guild_locale: LocaleString | null;
    data: ChatInputCommandData;
    id: string;
    application_id: string;
    token: string;
    app_permissions: string;
    constructor(interaction: APIChatInputApplicationCommandInteraction);
}
declare class ChatInputCommandData {
    users: Map<string, APIUser>;
    members: Map<string, APIInteractionDataResolvedGuildMember>;
    roles: Map<string, APIRole>;
    channels: Map<string, APIInteractionDataResolvedChannel>;
    messages: Map<string, APIMessage>;
    attachments: Map<string, APIAttachment>;
    options: Map<string, CommandOption>;
    constructor(data: APIChatInputApplicationCommandInteractionData);
}
declare class CommandOption {
    options: Map<string, CommandOption>;
    value: unknown;
    constructor(data: APIApplicationCommandInteractionDataOption | APIApplicationCommandInteractionDataBasicOption);
    asString(): string | null;
    asNumber(): number | null;
    asBoolean(): boolean | null;
}
declare class ContextMenuCommand {
    author: APIUser;
    member: APIInteractionGuildMember | null;
    guild_id: string | null;
    channel: APIContextMenuInteraction["channel"];
    locale: LocaleString;
    guild_locale: LocaleString | null;
    data: ContextMenuCommandData;
    target: string;
    id: string;
    application_id: string;
    token: string;
    app_permissions: string;
    constructor(interaction: APIContextMenuInteraction);
}
declare class ContextMenuCommandData {
    target_id: string;
    users: Map<string, APIUser>;
    members: Map<string, APIInteractionDataResolvedGuildMember>;
    messages: Map<string, APIMessage>;
    constructor(data: APIContextMenuInteractionData);
}
declare class CommandManager<Params extends Array<unknown>> {
    paramGetter: (command: APIChatInputApplicationCommandInteraction) => Params;
    errorHandler?: ((error: unknown) => unknown) | undefined;
    commands: Map<string, Command<Params>>;
    categories: Map<string, string[]>;
    constructor(paramGetter: (command: APIChatInputApplicationCommandInteraction) => Params, errorHandler?: ((error: unknown) => unknown) | undefined);
    assign(properties: Array<Command<Params>>): void;
    remove(commands: Array<string>): void;
    handle(command: APIChatInputApplicationCommandInteraction, snow?: SnowTransfer): boolean;
}
type Command<Params extends Array<unknown>> = {
    name: string;
    type?: 1 | 2 | 3;
    integration_types?: Array<number>;
    contexts?: Array<number>;
    options?: Array<APIApplicationCommandOption>;
    description: string;
    category: string;
    guild_ids?: Array<string>;
    examples?: Array<string>;
    order?: number;
    process(...args: Params): unknown;
};

export { ChatInputCommand, ChatInputCommandData, type Command, CommandManager, CommandOption, ContextMenuCommand, ContextMenuCommandData };
