import { Writable } from "node:stream";

import * as k8s from "@kubernetes/client-node";
import {
  ICredentialDataDecryptedObject,
  IExecuteFunctions,
  NodeOperationError,
} from "n8n-workflow";

export class K8SClient {
  kubeConfig: k8s.KubeConfig;
  constructor(
    credentials: ICredentialDataDecryptedObject,
    private readonly func: IExecuteFunctions,
  ) {
    if (credentials === undefined) {
      throw new NodeOperationError(
        func.getNode(),
        "No credentials got returned!",
      );
    }
    const kubeConfig = new k8s.KubeConfig();
    switch (credentials.loadFrom) {
      case "automatic":
        kubeConfig.loadFromDefault();
        break;
      case "file":
        if (
          typeof credentials.filePath !== "string" ||
          credentials.filePath === ""
        ) {
          throw new NodeOperationError(func.getNode(), "File path not set!");
        }
        kubeConfig.loadFromFile(credentials.filePath);
        break;
      case "content":
        if (
          typeof credentials.content !== "string" ||
          credentials.content === ""
        ) {
          throw new NodeOperationError(func.getNode(), "Content not set!");
        }
        kubeConfig.loadFromString(credentials.content);
        break;
      default:
        throw new NodeOperationError(
          func.getNode(),
          "Load from value not set!",
        );
    }
    this.kubeConfig = kubeConfig;
  }
  async runPodAndGetOutput(
    image: string,
    args: string[],
    podName?: string,
    namespace = "default",
  ): Promise<string> {
    const kc = this.kubeConfig;

    const k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);
    const watch = new k8s.Watch(kc);

    podName ??= `n8n-pod-${Date.now()}`;

    const podSpec: k8s.V1Pod = {
      metadata: {
        name: podName,
      },
      spec: {
        restartPolicy: "Never",
        containers: [
          {
            name: "main-container",
            image: image,
            args,
          },
        ],
      },
    };

    await k8sCoreApi.createNamespacedPod(namespace, podSpec);

    try {
      return await new Promise(async (resolve, reject) => {
        const watchReq = await watch.watch(
          `/api/v1/namespaces/${namespace}/pods`,
          {},
          (type, obj: k8s.V1Pod) => {
            if (obj.metadata?.name !== podName) {
              return;
            }
            const phase = obj.status?.phase;
            if (phase === "Succeeded" || phase === "Failed") {
              let logs = "";
              const logStream = new Writable({
                write(chunk, encoding, callback) {
                  logs += chunk.toString();
                  callback();
                },
              });

              const logApi = new k8s.Log(kc);
              logApi
                .log(namespace, podName, "main-container", logStream)
                .then((req) => {
                  req.on("error", reject);
                  req.on("complete", () => {
                    watchReq?.abort();
                    resolve(logs);
                  });
                })
                .catch((err) => {
                  watchReq?.abort();
                  reject(err);
                });
            }
          },
          (err) => {
            reject(err);
          },
        );
      });
    } catch (e) {
      if (e.message === "aborted") {
        // This is fine
      } else {
        throw e;
      }
    } finally {
      await k8sCoreApi.deleteNamespacedPod(podName, namespace);
    }
  }
}
