export var NodeType;
(function (NodeType) {
    NodeType["START"] = "START";
    NodeType["CONTENT"] = "CONTENT";
    NodeType["MENU"] = "MENU";
    NodeType["RANDOMIZER"] = "RANDOMIZER";
    NodeType["DELAY"] = "DELAY";
    NodeType["TICKET"] = "TICKET";
    NodeType["TYPEBOT"] = "TYPEBOT";
    NodeType["OPENAI"] = "OPENAI";
    NodeType["CONDITION"] = "CONDITION";
    NodeType["HTTP"] = "HTTP";
    NodeType["SCHEDULE"] = "SCHEDULE";
    NodeType["ASSIGN_QUEUE"] = "ASSIGN_QUEUE";
    NodeType["SUBFLOW"] = "SUBFLOW";
})(NodeType || (NodeType = {}));
export var FlowStatus;
(function (FlowStatus) {
    FlowStatus["DRAFT"] = "DRAFT";
    FlowStatus["PUBLISHED"] = "PUBLISHED";
    FlowStatus["ARCHIVED"] = "ARCHIVED";
})(FlowStatus || (FlowStatus = {}));
