pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps {
                // Jenkins pulls your latest code from GitHub
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                echo 'Installing dependencies...'
                bat 'npm install'
                bat 'pip install -r backend/requirements.txt'
            }
        }

        stage('Build Python Engine') {
            // ONLY runs if files in the backend folder were modified
            when { changeset "backend/**" } 
            steps {
                echo 'Backend changes detected. Rebuilding Python Engine...'
                bat 'cd backend && pyinstaller --onefile app.py'
            }
        }

        stage('Package Electron App') {
            steps {
                echo 'Building final ToolSuite Installer...'
                // This command bundles everything into the Setup.exe
                bat 'npm run dist'
            }
        }

        stage('Archive Release') {
            steps {
                // This "saves" the .exe inside Jenkins so you can download it from the dashboard
                archiveArtifacts artifacts: 'dist/*.exe', allowEmptyArchive: true
            }
        }
    }
    
    post {
        always {
            echo 'Build Process Completed.'
        }
    }
}