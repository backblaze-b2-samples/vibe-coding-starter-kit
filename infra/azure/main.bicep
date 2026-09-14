targetScope = 'subscription'

@minLength(1)
@maxLength(40)
@description('Azure Developer CLI environment name used to identify this deployment.')
param environmentName string

@minLength(1)
@description('Primary Azure location for the deployment.')
param location string

@secure()
@description('Least-privilege Backblaze B2 application key ID.')
param b2KeyId string

@secure()
@description('Least-privilege Backblaze B2 application key secret.')
param b2ApplicationKey string

@description('Backblaze B2 S3-compatible endpoint, including https://.')
param b2Endpoint string

@description('Backblaze B2 bucket name dedicated to this deployment.')
param b2BucketName string

@description('Whether the web Container App already exists. Managed by azd.')
param webExists bool = false

@description('Whether the API Container App already exists. Managed by azd.')
param apiExists bool = false

var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))
var tags = {
  'azd-env-name': environmentName
  application: 'vibe-coding-starter-kit'
}

resource resourceGroup 'Microsoft.Resources/resourceGroups@2024-11-01' = {
  name: 'rg-${environmentName}-${resourceToken}'
  location: location
  tags: tags
}

module logAnalytics './log-analytics.bicep' = {
  name: 'log-${resourceToken}'
  scope: resourceGroup
  params: {
    name: 'log-${resourceToken}'
    location: location
    tags: tags
  }
}

module containerApps 'br/public:avm/ptn/azd/container-apps-stack:0.4.0' = {
  name: 'container-apps-stack'
  scope: resourceGroup
  params: {
    containerAppsEnvironmentName: 'cae-${resourceToken}'
    containerRegistryName: 'acr${resourceToken}'
    logAnalyticsWorkspaceName: logAnalytics.outputs.name
    location: location
    tags: tags
    acrSku: 'Basic'
    acrAdminUserEnabled: false
    publicNetworkAccess: 'Enabled'
    zoneRedundant: false
  }
}

module webIdentity 'br/public:avm/res/managed-identity/user-assigned-identity:0.6.0' = {
  name: 'web-identity'
  scope: resourceGroup
  params: {
    name: 'id-web-${resourceToken}'
    location: location
    tags: tags
  }
}

module web 'br/public:avm/ptn/azd/container-app-upsert:0.4.0' = {
  name: 'web-container-app'
  scope: resourceGroup
  params: {
    name: 'ca-web-${resourceToken}'
    location: location
    tags: union(tags, { 'azd-service-name': 'web' })
    containerAppsEnvironmentName: containerApps.outputs.environmentName
    containerRegistryName: containerApps.outputs.registryName
    identityType: 'UserAssigned'
    identityName: webIdentity.name
    userAssignedIdentityResourceId: webIdentity.outputs.resourceId
    identityPrincipalId: webIdentity.outputs.principalId
    exists: webExists
    ingressEnabled: true
    external: true
    targetPort: 3000
    containerCpuCoreCount: '0.5'
    containerMemory: '1.0Gi'
    containerMinReplicas: 1
    containerMaxReplicas: 1
    containerProbes: [
      {
        type: 'Readiness'
        httpGet: {
          path: '/'
          port: 3000
          scheme: 'HTTP'
        }
        initialDelaySeconds: 5
        periodSeconds: 10
        timeoutSeconds: 5
      }
    ]
  }
}

module apiIdentity 'br/public:avm/res/managed-identity/user-assigned-identity:0.6.0' = {
  name: 'api-identity'
  scope: resourceGroup
  params: {
    name: 'id-api-${resourceToken}'
    location: location
    tags: tags
  }
}

module api 'br/public:avm/ptn/azd/container-app-upsert:0.4.0' = {
  name: 'api-container-app'
  scope: resourceGroup
  params: {
    name: 'ca-api-${resourceToken}'
    location: location
    tags: union(tags, { 'azd-service-name': 'api' })
    containerAppsEnvironmentName: containerApps.outputs.environmentName
    containerRegistryName: containerApps.outputs.registryName
    identityType: 'UserAssigned'
    identityName: apiIdentity.name
    userAssignedIdentityResourceId: apiIdentity.outputs.resourceId
    identityPrincipalId: apiIdentity.outputs.principalId
    exists: apiExists
    ingressEnabled: true
    external: true
    targetPort: 8000
    containerCpuCoreCount: '0.5'
    containerMemory: '1.0Gi'
    containerMinReplicas: 1
    containerMaxReplicas: 1
    secrets: [
      {
        name: 'b2-key-id'
        value: b2KeyId
      }
      {
        name: 'b2-application-key'
        value: b2ApplicationKey
      }
    ]
    env: [
      {
        name: 'B2_KEY_ID'
        secretRef: 'b2-key-id'
      }
      {
        name: 'B2_APPLICATION_KEY'
        secretRef: 'b2-application-key'
      }
      {
        name: 'B2_ENDPOINT'
        value: b2Endpoint
      }
      {
        name: 'B2_BUCKET_NAME'
        value: b2BucketName
      }
      {
        name: 'API_CORS_ORIGINS'
        value: web.outputs.uri
      }
      {
        name: 'ENABLE_DOCS'
        value: 'false'
      }
      {
        name: 'WARM_LIST_CACHE_ON_STARTUP'
        value: 'false'
      }
    ]
    allowedOrigins: [
      web.outputs.uri
    ]
    containerProbes: [
      {
        type: 'Readiness'
        httpGet: {
          path: '/health'
          port: 8000
          scheme: 'HTTP'
        }
        initialDelaySeconds: 5
        periodSeconds: 10
        timeoutSeconds: 5
      }
      {
        type: 'Liveness'
        httpGet: {
          path: '/health'
          port: 8000
          scheme: 'HTTP'
        }
        initialDelaySeconds: 15
        periodSeconds: 30
        timeoutSeconds: 5
      }
    ]
  }
}

output AZURE_CONTAINER_ENVIRONMENT_NAME string = containerApps.outputs.environmentName
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = containerApps.outputs.registryLoginServer
output AZURE_CONTAINER_REGISTRY_NAME string = containerApps.outputs.registryName
output AZURE_LOCATION string = location
output AZURE_RESOURCE_GROUP string = resourceGroup.name
output SERVICE_API_NAME string = api.outputs.name
output SERVICE_API_URI string = api.outputs.uri
output SERVICE_WEB_NAME string = web.outputs.name
output SERVICE_WEB_URI string = web.outputs.uri
