import { Writable } from "node:stream";

import Dockerode from "dockerode";
import {
    IDataObject,
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
    NodeExecutionWithMetadata,
    NodeOperationError,
} from "n8n-workflow";

async function run(
    docker: Dockerode,
    image: string,
    cmd: string[],
    createOptions?: Dockerode.ContainerCreateOptions,
    startOptions?: Dockerode.ContainerStartOptions,
) {
    let stdout = "";
    let stderr = "";

    const outStream = new Writable({
        write(chunk, encoding, done) {
            stdout += chunk.toString();
            done();
        },
    });

    const errStream = new Writable({
        write(chunk, encoding, done) {
            stderr += chunk.toString();
            done();
        },
    });

    await docker.run(
        image,
        cmd,
        [outStream, errStream],
        {
            ...createOptions,
            Tty: false,
        },
        startOptions,
    );

    return { stdout, stderr };
}

/**
 * Build Docker volume configuration from n8n volume mount parameters
 * @param volumeMounts - Volume mount configuration from n8n UI
 * @returns Docker API-compatible Volumes and Binds configuration
 * @throws Error if container path or host path is missing
 */
function buildVolumeConfig(volumeMounts: any): {
    Volumes: { [key: string]: {} };
    Binds: string[];
} {
    // Handle empty/undefined input
    if (!volumeMounts?.mount || volumeMounts.mount.length === 0) {
        return { Volumes: {}, Binds: [] };
    }

    const volumes: { [key: string]: {} } = {};
    const binds: string[] = [];

    for (const mount of volumeMounts.mount) {
        const { hostPath, containerPath, readOnly } = mount;

        // Validate required fields - THROW ERROR
        if (!containerPath || containerPath.trim() === "") {
            throw new Error("Container path is required for volume mount");
        }

        if (!hostPath || hostPath.trim() === "") {
            throw new Error("Host path is required for volume mount");
        }

        // Declare volume exists in container
        volumes[containerPath.trim()] = {};

        // Create bind mount specification
        const mode = readOnly ? "ro" : "rw";
        binds.push(`${hostPath.trim()}:${containerPath.trim()}:${mode}`);
    }

    return { Volumes: volumes, Binds: binds };
}

export class Docker implements INodeType {
    description: INodeTypeDescription = {
        displayName: "Docker",
        name: "docker",
        icon: "file:docker.svg",
        group: ["output"],
        version: 1,
        subtitle:
            '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
        description: "Interact with Docker",
        defaults: {
            name: "Docker",
        },
        inputs: ["main"],
        outputs: ["main"],
        credentials: [
            {
                name: "dockerCredentialsApi",
                required: true,
            },
        ],
        properties: [
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                options: [
                    {
                        name: "Get",
                        value: "get",
                    },
                    {
                        name: "List",
                        value: "list",
                    },
                    {
                        name: "Run",
                        value: "run",
                    },
                ],
                default: "get",
            },
            {
                displayName: "Resource",
                name: "resource",
                type: "options",
                noDataExpression: true,
                options: [
                    {
                        name: "Container",
                        value: "container",
                    },
                    {
                        name: "Image",
                        value: "image",
                    },
                    {
                        name: "Volume",
                        value: "volume",
                    },
                    {
                        name: "Network",
                        value: "network",
                    },
                ],
                default: "container",
                displayOptions: {
                    hide: {
                        operation: ["run"],
                    },
                },
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                displayOptions: {
                    show: {
                        operation: ["get"],
                    },
                },
            },
            {
                displayName: "Options",
                name: "options",
                type: "json",
                default: "{}",
                displayOptions: {
                    show: {
                        operation: ["list"],
                    },
                },
            },
            {
                displayName: "Image",
                name: "image",
                type: "string",
                default: "",
                displayOptions: {
                    show: {
                        operation: ["run"],
                    },
                },
            },
            {
                displayName: "Command",
                name: "command",
                type: "json",
                default: "[]",
                displayOptions: {
                    show: {
                        operation: ["run"],
                    },
                },
            },
            {
                displayName: "Volume Mounts",
                name: "volumeMounts",
                type: "fixedCollection",
                typeOptions: {
                    multipleValues: true,
                    multipleValueButtonText: "Add Volume",
                },
                default: {},
                displayOptions: {
                    show: {
                        operation: ["run"],
                    },
                },
                options: [
                    {
                        name: "mount",
                        displayName: "Mount",
                        values: [
                            {
                                displayName: "Host Path",
                                name: "hostPath",
                                type: "string",
                                default: "",
                                placeholder: "/host/path or volume-name",
                                description:
                                    "Path on the host machine or Docker volume name",
                                required: true,
                            },
                            {
                                displayName: "Container Path",
                                name: "containerPath",
                                type: "string",
                                default: "",
                                placeholder: "/container/path",
                                description:
                                    "Path inside the container where the volume will be mounted",
                                required: true,
                            },
                            {
                                displayName: "Read Only",
                                name: "readOnly",
                                type: "boolean",
                                default: false,
                                description:
                                    "Whether to mount the volume as read-only",
                            },
                        ],
                    },
                ],
                description:
                    "Mount host directories or Docker volumes into the container",
            },
            {
                displayName: "Working Directory",
                name: "workingDir",
                type: "string",
                default: "",
                placeholder: "/app",
                displayOptions: {
                    show: {
                        operation: ["run"],
                    },
                },
                description:
                    "Working directory inside the container. Commands will execute from this path.",
            },
        ],
    };
    async execute(
        this: IExecuteFunctions,
    ): Promise<INodeExecutionData[][] | NodeExecutionWithMetadata[][]> {
        const result: INodeExecutionData[] = [];
        for (let idx = 0; idx < this.getInputData().length; idx++) {
            const credentials = await this.getCredentials(
                "dockerCredentialsApi",
                idx,
            );
            if (credentials === undefined) {
                throw new NodeOperationError(
                    this.getNode(),
                    "No credentials got returned!",
                );
            }
            const docker = new Dockerode(credentials);
            let data: IDataObject = undefined;
            const operation = this.getNodeParameter("operation", idx) as string;

            if (operation === "run") {
                const image = this.getNodeParameter("image", idx) as string;
                const command = JSON.parse(
                    this.getNodeParameter("command", idx) as any,
                );
                if (!Array.isArray(command)) {
                    throw new NodeOperationError(
                        this.getNode(),
                        "Command must be an array!",
                    );
                }

                // Get volume mount configuration
                const volumeMounts = this.getNodeParameter(
                    "volumeMounts",
                    idx,
                    {},
                ) as any;

                // Build Docker-compatible volume config (throws on invalid data)
                let volumeConfig;
                try {
                    volumeConfig = buildVolumeConfig(volumeMounts);
                } catch (error) {
                    throw new NodeOperationError(
                        this.getNode(),
                        `Volume mount configuration error: ${error.message}`,
                    );
                }

                // Get working directory
                const workingDir = this.getNodeParameter(
                    "workingDir",
                    idx,
                    "",
                ) as string;

                await docker.pull(image);

                data = await run(docker, image, command, {
                    Volumes: volumeConfig.Volumes,
                    WorkingDir: workingDir || undefined,
                    HostConfig: {
                        AutoRemove: true,
                        Binds: volumeConfig.Binds,
                    },
                });
            } else {
                const resource = this.getNodeParameter(
                    "resource",
                    idx,
                ) as string;
                let options: any = undefined;
                if (operation === "list") {
                    options = this.getNodeParameter("options", idx);
                } else {
                    options = this.getNodeParameter("id", idx);
                }
                const action = `${operation}${resource[0].toUpperCase()}${resource.slice(
                    1,
                )}${operation === "list" ? "s" : ""}`;
                this.sendMessageToUI(
                    "credentials:" + JSON.stringify(credentials),
                );
                this.sendMessageToUI("action:" + JSON.stringify(action));

                data = await docker[action](options);
            }

            result.push(
                ...this.helpers.constructExecutionMetaData(
                    this.helpers.returnJsonArray(data),
                    { itemData: { item: idx } },
                ),
            );
        }

        return [result];
    }
}
