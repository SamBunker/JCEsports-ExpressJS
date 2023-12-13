# Database Creation #
To create the database in phpmyadmin, copy the following entries.
## Players Table ##
CREATE TABLE IF NOT EXISTS  players(
       id INT(6) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
       number INT(4) NOT NULL, 
       name VARCHAR(30) NOT NULL, 
       gamertag VARCHAR(30) NOT NULL,
       team VARCHAR(30) NOT NULL,
       position VARCHAR(30) NOT NULL,
       grade ENUM (‘Post-Grad’, ‘Senior’, ‘Junior’, ‘Sophomore’, ‘Freshman’) NOT NULL,
       hometown_highschool VARCHAR(50) NOT NULL,
       country_code VARCHAR(3) NOT NULL
       )

## Users Table ##
CREATE TABLE IF NOT EXISTS  users(
       email VARCHAR(50) PRIMARY KEY,
       username VARCHAR(30) NOT NULL, 
       password VARCHAR(30) NOT NULL,
       authority ENUM (‘admin’, ‘member’) NOT NULL,
       )
