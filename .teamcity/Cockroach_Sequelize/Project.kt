package Cockroach_Sequelize

import Cockroach_Sequelize.buildTypes.*
import jetbrains.buildServer.configs.kotlin.v10.*
import jetbrains.buildServer.configs.kotlin.v10.Project
import jetbrains.buildServer.configs.kotlin.v10.projectFeatures.VersionedSettings
import jetbrains.buildServer.configs.kotlin.v10.projectFeatures.VersionedSettings.*
import jetbrains.buildServer.configs.kotlin.v10.projectFeatures.versionedSettings

object Project : Project({
    uuid = "d876f2bd-f45d-4650-b9c1-4676bb86dd0b"
    extId = "Cockroach_Sequelize"
    parentId = "Cockroach"
    name = "Sequelize"

    buildType(Cockroach_Sequelize_SequelizeUnitTests)

    features {
        versionedSettings {
            id = "PROJECT_EXT_7"
            mode = VersionedSettings.Mode.ENABLED
            buildSettingsMode = VersionedSettings.BuildSettingsMode.PREFER_SETTINGS_FROM_VCS
            rootExtId = "Cockroach_HttpsGithubComCockroachdbSequelizeCockroachdbRefsHeadsMaster"
            showChanges = false
            settingsFormat = VersionedSettings.Format.KOTLIN
            param("credentialsStorageType", "credentialsJSON")
        }
    }
})
