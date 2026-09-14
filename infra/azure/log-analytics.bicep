targetScope = 'resourceGroup'

@description('Name of the Log Analytics workspace.')
param name string

@description('Azure location for the workspace.')
param location string = resourceGroup().location

@description('Tags applied to the workspace.')
param tags object = {}

resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    retentionInDays: 30
    sku: {
      name: 'PerGB2018'
    }
    workspaceCapping: {
      dailyQuotaGb: 1
    }
  }
}

output name string = workspace.name
