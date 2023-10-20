// server.js
require('dotenv').config();

const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const { sequelize, WishlistUser, WishlistItem, Reservation} = require('./models');
const User = require('./models/user');
const Wishlist = require('./models/wishlist');
const UserInvitation = require('./models/userInvitation');
const PasswordRequest = require('./models/passwordRequest');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const bcrypt = require('bcrypt');
const app = express();
const refreshTokens = [];
const PORT = 5000;

app.use(cors());
app.use(express.json());

const transporter = nodemailer.createTransport({
    host: "smtp.forwardemail.net",
    port: 587,
    secure: false,
    auth: {
        user: process.env.AUTH_EMAIL_USER,
        pass: process.env.AUTH_EMAIL_PASSWORD
    }
});

// Middleware pour vérifier le token JWT
const verifyJWT = (req, res, next) => {

    // Get the token from the headers
    const token = req.headers['x-access-token'];

    if (!token) {
        // If there is no token
        return res.status(403).json({ message: "No token provided" });
    }

    // Verify the token
    jwt.verify(token, process.env.SECRET_TOKEN, (error, decodedToken) => {
        if (error) {
            // If the verification fails
            return res.status(401).json({ message: "Failed to authenticate token" });
        } else {
            // If the verification is successful, add the decoded token to the request object
            req.user = decodedToken;
            console.log("Decoded JWT:", req.user);
            next();
        }
    });
};

// Routes
app.post('/token', async (req, res) => {
    const { username, refreshToken } = req.body;

    // Récupération de l'utilisateur de manière asynchrone
    try {
        const user = await User.findOne({ where: { username } });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const id = user.id;

        // Remarque : Vous devriez également vérifier si le refreshToken est associé à cet utilisateur spécifique dans votre base de données.
        // Pour ce faire, vous devriez normalement stocker les refreshTokens avec l'ID utilisateur correspondant.
        if (!refreshToken || !refreshTokens.includes(refreshToken)) {
            return res.sendStatus(403);
        }

        jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
            if (err) {
                return res.sendStatus(403);
            }

            const accessToken = jwt.sign({ id }, process.env.SECRET_TOKEN, {
                expiresIn: '1d', // 1 jour
            });
            return res.status(200).json({ accessToken: accessToken });
        });
    } catch (error) {
        console.error("Error while fetching user:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
});

// Route pour s'inscrire (créer un nouvel utilisateur)
app.post('/signup', async (req, res) => {

    try {

        // Vérification des entrées
        if (!req.body.username || !req.body.password || !req.body.email) {
            return res.status(400).send({ message: "Required fields are missing." });
        }

        // Vérifiez si le pseudo existe déjà
        const usernameExists = await User.findOne({ where: { username: req.body.username } });
        if (usernameExists) {
            return res.status(400).send({ message: "Error: username or email already exists." });
        }

        // Vérifier si l'email existe déjà
        const emailExists = await User.findOne({ where: { email: req.body.email } });
        if (emailExists) {
            return res.status(400).send({ message: "Error: username or email already exists." });
        }

        const newUser = new User({
            username: req.body.username,
            password: req.body.password,
            email: req.body.email,
        });

        await User.addUser(newUser);
        return res.status(200).json({ success: true, message: 'User registered' });

    } catch (error) {
        console.error('Error during signup:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post('/activate', async (req, res) => {
    const { username, password, token } = req.body;

    // Vérification des entrées
    if (!username || !password || !token) {
        return res.status(400).send({ message: "Required fields are missing." });
    }

    try {
        // Décodage du token
        const decodedToken = jwt.verify(token, process.env.EMAIL_TOKEN_SECRET);
        const userEmail = decodedToken.user_email;

        // Vérifier l'invitation
        const invitation = await UserInvitation.findOne({
            where: { token: token, user_email: userEmail }
        });

        if (!invitation) {
            return res.status(400).send({ message: "Invalid or expired activation link." });
        }

        let user = await User.findOne({ where: { email: userEmail } });

        if (!user) {
            // Si l'utilisateur n'existe pas, créez-le
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            user = await User.create({
                username: username,
                password: hashedPassword,
                email: userEmail
            });
        }

        // Ajoutez l'utilisateur à la liste de souhaits
        await Wishlist.addUser(invitation.wishlist_id, user.id);
        await invitation.destroy();
        return res.json({ success: true, message: 'User activated and added to wishlist' });

    } catch (error) {
        console.error("Error during activation:", error);
        return res.status(500).send({ message: "Internal server error." });
    }
});

app.post('/reset-password', async (req, res) => {
    const { password, token } = req.body;

    // Vérification des entrées
    if (!password || !token) {
        return res.status(400).send({ message: "Required fields are missing." });
    }

    try {

        // Décodage du token
        const decodedToken = jwt.verify(token, process.env.EMAIL_TOKEN_SECRET);
        const userEmail = decodedToken.user_email;

        // Vérifier l'invitation
        const passwordRequest = await PasswordRequest.findOne({
            where: { token: token, user_email: userEmail }
        });

        if (!passwordRequest) {
            return res.status(400).send({ message: "Invalid or expired reset link." });
        }

        let user = await User.findOne({ where: { email: userEmail } });

        if (!user) {
            return res.status(404).send({ message: "User not found." });
        }

        // Enregistrer le nouveau mot de passe
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Supprimer la demande de mot de passe
        await passwordRequest.destroy();

        user.password = hashedPassword;
        await user.save();

        return res.json({ success: true, message: 'Password updated with success.' });

    } catch (error) {
        console.error("Error during activation:", error);
        return res.status(500).send({ message: "Internal server error." });
    }
});


// Route pour créer une wishlist
app.post('/wishlist', verifyJWT, async (req, res) => {

    const userId = req.user.id;
    const newWishlist = new Wishlist ({
        name: req.body.title,
        description: req.body.description,
        auteur_id: userId,
    });

    const savedWishlist = await newWishlist.save();
    Wishlist.addUser(savedWishlist.id, userId, (err) => {
        if (err) {
            res.json({ success: false, message: 'Failed to add user to wishlist' });
        } else {
            res.json({ success: true, message: 'Wishlist created' });
        }
    });
});

// Route pour se déconnecter
app.post('/logout', (req, res) => {
    const refreshToken = req.body.token;
    const index = refreshTokens.indexOf(refreshToken);
    if (index !== -1) {
        refreshTokens.splice(index, 1);
    }
    res.sendStatus(204);
});

// Route pour se connecter (vérifier l'utilisateur et le mot de passe)
app.post('/login', async (req, res) => {

    const { email, password } = req.body;

    try {

        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const id = user.id;
        const token = jwt.sign({ id }, process.env.SECRET_TOKEN, {
            expiresIn: 1500, // 25 minutes
        });
        const refreshToken = jwt.sign({ id }, process.env.REFRESH_TOKEN_SECRET, {
            expiresIn: '1d', // 1 jour
        });

        refreshTokens.push(refreshToken);

        // Authentification réussie
        res.json({
            message: 'Login successful',
            userId: user.id,
            userLogin: user.username,
            token: token,
            refreshToken: refreshToken,  // Retourne le refresh token dans la réponse
        });

    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Route pour récupéérer un mot de passe perdu
app.post('/forget-password', async (req, res) => {

    const user = await User.findOne({
        where: { email: req.body.email },
    });

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    } else {

        const passwordRequest = await PasswordRequest.create({
            user_id: user.id,
            token: jwt.sign({ user_email: req.body.email }, process.env.EMAIL_TOKEN_SECRET, {
                expiresIn: 60 * 60 * 24, // 24 hours
            }),
            user_email: req.body.email,
            expirationDate: Date.now() + 60 * 60 * 24 * 1000, // 24 hours
        });

        const resetPasswordUrl = process.env.FRONT_END_URL + `/reset-password?resetPasswordToken=${passwordRequest.token}`;
        const resetPasswordTemplate = fs.readFileSync(path.join(__dirname, 'email_template/resetPassword.html'), 'utf-8');
        const emailContent = resetPasswordTemplate.replace("[USERNAME]", user.username).replace("[PWD_RESET_LINK]", resetPasswordUrl);

        const mailOptions = {
            from: process.env.EMAIL_FROM_MAIL,
            to: req.body.email,
            subject: 'Password reset request',
            html: emailContent
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log(error);
                return res.status(500).json({ message: 'Internal error. Please try again latter.' });
            } else {
                console.log('Email sent: ' + info.response);
                return res.status(200).json({ success: true, message: 'Request sent' });
            }
        });

        return res.status(200).json({ success: true, message: 'Email sent' });
    }
});

// Route pour inviter un utilisateur à une wishlist
app.post('/wishlist/invite/:wishlistId', verifyJWT, async (req, res) => {

    const user = await User.findOne({
        where: { email: req.body.invitationMail },
    });

    const wishlist = await Wishlist.findOne({
        where: { id: req.params.wishlistId },
        include: { model: User, attributes: ['id', 'username'] },
    });

    // Check if the user exists
    if (!user) {
        console.log('User not found');

        // Check if there is already an invitation for this email and this wishlist
        const invitation = await UserInvitation.findOne({
            where: { wishlist_id: req.params.wishlistId, user_email: req.body.invitationMail },
        });

        if (invitation) {
            return res.status(404).json({ message: 'User already invited to this wishlist' });
        }

        // Create a new userInvitation for the wishlist and the email
        const newInvitation = await UserInvitation.create({
            wishlist_id: req.params.wishlistId,
            user_email: req.body.invitationMail,
            token: jwt.sign({ user_email: req.body.invitationMail }, process.env.EMAIL_TOKEN_SECRET, {
                expiresIn: 60 * 60 * 24, // 24 hours
            }),
            expirationDate: Date.now() + 60 * 60 * 24 * 1000, // 24 hours
        });

        if (newInvitation) {

            const activationUrl = process.env.FRONT_END_URL + `/activate?activationToken=${newInvitation.token}`;
            const inviteUserToWishlistTemplate = fs.readFileSync(path.join(__dirname, 'email_template/inviteUserToWishlistNewUser.html'), 'utf-8');
            const emailContent = inviteUserToWishlistTemplate.replace("[USERNAME]", newInvitation.user_email).replace("[ACTIVATION_LINK]", activationUrl);

            // Invitation created, send an email to confirm the invitation
            const mailOptions = {
                from: process.env.EMAIL_FROM_MAIL,
                to: req.body.invitationMail,
                subject: 'You \'ve been invited to a new wishlist',
                html: emailContent
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.log(error);
                    return res.status(500).json({ message: 'Internal error. Please try again latter.' });
                } else {
                    console.log('Email sent: ' + info.response);
                    return res.status(200).json({ success: true, message: 'Invitation sent' });
                }
            });
        }
    } else {

        try {
            await Wishlist.addUser(req.params.wishlistId, user.id);

            const inviteUserToWishlistTemplate = fs.readFileSync(path.join(__dirname, 'email_template/inviteUserToWishlistUserExist.html'), 'utf-8');
            const emailContent = inviteUserToWishlistTemplate
                .replace("[USERNAME]", user.username)
                .replace("[WEBSITE_URL]", process.env.FRONT_END_URL)
                .replace("[SENDER]", wishlist.User.username)
                .replace("[WISHLIST_NAME]", wishlist.name)
            ;

            // User found, send en email to confirm the invitation
            const mailOptions = {
                from: process.env.EMAIL_FROM_MAIL,
                to: req.body.invitationMail,
                subject: 'You \'ve been invited to a new wishlist',
                html: emailContent
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.log(error);
                    return res.status(500).json({ message: 'Internal error. Please try again latter.' });
                } else {
                    console.log('Email sent: ' + info.response);
                    return res.status(200).json({ success: true, message: 'Invitation sent' });
                }
            });

            res.json({ success: true, message: 'User added to wishlist' });
        } catch (error) {
            console.error('Error during invitation:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }
});

// Route pour ajouter un item à un wishlistUser
app.post('/wishlist/:wishlistId/item', verifyJWT, async (req, res) => {

    try {
        const wishlistUser = await WishlistUser.findOne({
            where: { wishlist_id: req.params.wishlistId, UserId: req.user.id },
        });

        if (!wishlistUser) {
            return res.status(404).json({ message: 'Wishlist not found' });
        } else {
            const newItem = await WishlistItem.create({
                itemName: req.body.name,
                description: req.body.description,
                url: req.body.url,
                bought: false,
                wishlistUser_id: wishlistUser.id,
            });
            res.json({ success: true, message: 'Item added to wishlist' });
        }
    } catch (error) {
        console.error('Failed to add item to wishlist:', error);
        return res.json({ success: false, message: 'Failed to add item to wishlist' });
    }
});

// Route pour clôturer une wishlist
app.put('/wishlist/:wishlistId/close', verifyJWT, async (req, res) => {

        const wishlist = await Wishlist.findOne({
            where: { id: req.params.wishlistId },
        });

        if (!wishlist) {
            return res.status(404).json({ message: 'Wishlist not found' });
        } else {
            Wishlist.update({ isClosed: true }, {
                where: { id: req.params.wishlistId },
            });
            res.json({ success: true, message: 'Wishlist closed' });
        }
});

app.get('/user/me', verifyJWT, async (req, res) => {
    try {
        // Use the token to get the user's information
        const user = await User.findOne({
            where: { id: req.user.id },
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        } else {
            return res.json(user);
        }
    } catch (error) {
        console.error('Error during login:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post('/reservation', verifyJWT,async (req, res) => {
    try {
        const { item_id, reservingUser_id } = req.body;

        // Vérifiez si l'item est déjà réservé
        const reservation = await Reservation.findOne(
            { where: { reservingUser_id: reservingUser_id, wishlistItem_id: item_id } }
        );

        const wishlistItem = await WishlistItem.findOne(
            { where: { id: item_id } }
        );

        if (!reservation) {
            // Créer une nouvelle réservation
            const newReservation = await Reservation.create({
                reservingUser_id: reservingUser_id,
                wishlistItem_id: item_id,
                reserved: true,
            });

            wishlistItem.reserved = true;
            wishlistItem.reservedBy = reservingUser_id;
            await wishlistItem.save();

            return res.send({ message: 'Item reserved successfully.' });
        } else if  (reservation.reserved) {
            return res.status(400).send({ message: 'Item is already reserved.' });
        } else {
            // Mettez à jour la réservation pour indiquer qu'elle est réservée
            reservation.reserved = true;
            reservation.reservingUser_id = reservingUser_id;
            await reservation.save();

            wishlistItem.reserved = true;
            wishlistItem.reservedBy = reservingUser_id;
            await wishlistItem.save();

            return res.send({ message: 'Item reserved successfully.' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Server error.' });
    }
});

// Route pour vérifier si un utilisateur existe et récupérer ses informations selon son nom d'utilisateur
app.post('/user/exists', async (req, res) => {
    try {
        const user = await User.findOne({
            where: { username: req.body.username },
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        } else {
            return res.json(user);
        }
    } catch (error) {
        console.error('Error during login:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Route pour récupérer une wishlist selon l'id
app.get('/wishlist/:wishlistId', async (req, res) => {
    try {
        const wishlist = await Wishlist.findOne({
            where: { id: req.params.wishlistId },
            include: { model: User, attributes: ['id', 'username'] }, // Inclure les informations de l'utilisateur associé
        });

        if (!wishlist) {
            return res.status(404).json({ message: 'Wishlist not found' });
        } else {
            return res.json(wishlist);
        }
    } catch (error) {
        console.error('Error during login:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Route pour récupérer les listes de souhaits de l'utilisateur connecté
app.get('/user/wishlist', verifyJWT, async (req, res) => {

    try {

        // Récupère l'utilisateur connecté (req.user) avec ses wishlists associées
        const userWithWishlists = await User.findOne({
            where: { id: req.user.id },
            include: {
                model: Wishlist,
                through: { attributes: [] }, // Ceci exclut les attributs de la table de jonction dans le résultat final
                where: { isClosed: false },
                include: { model: User, attributes: ['username'] }, // Inclure les informations de l'utilisateur associé
            },
        });

        // Si l'utilisateur n'a pas de wishlists associées
        if (!userWithWishlists || userWithWishlists.Wishlists.length === 0) {
            return res.status(404).json({ message: 'Aucune wishlist trouvée pour l\'utilisateur connecté' });
        }

        // Renvoie les wishlists de l'utilisateur en réponse
        return res.status(200).json(userWithWishlists.Wishlists);

    } catch (error) {
        console.error('Erreur lors de la récupération des wishlists de l\'utilisateur :', error);
        return res.status(500).json({ message: 'Erreur serveur lors de la récupération des wishlists' });
    }
});

// Route pour récupérer les utilisateurs associés à une wishlist
app.get('/wishlist/:wishlistId/users', verifyJWT, async (req, res) => {

    try {

        const { wishlistId } = req.params;
        const wishlist = await Wishlist.findByPk(wishlistId);
        if (!wishlist) {
            return res.status(404).json({ message: 'Wishlist not found' });
        }

        // Récupère la liste des utilisateurs associés à la wishlist
        const users = await User.findAll({
            include: [
                {
                    model: Wishlist,
                    where: { id: wishlistId },
                    through: { attributes: [] } // Pour exclure les attributs de la table de liaison (WishlistUser) des résultats
                }
            ]
        });

        // Si l'utilisateur n'est pas associé à la wishlist ou si la wishlist n'existe pas
        if (!users) {
            return res.status(404).json({ message: 'Aucune wishlist trouvée pour l\'utilisateur connecté' });
        }

        // Renvoie les utilisateurs de la wishlist en réponse
        return res.json(users);

    } catch (error) {
        console.error('Erreur lors de la récupération des utilisateurs de la wishlist :', error);
        return res.status(500).json({ message: 'Erreur serveur lors de la récupération des utilisateurs' });
    }
});

// Route pour récupérer les items d'une wishlistUser
app.get('/wishlist/:wishlistId/items', verifyJWT, async (req, res) => {
    try {
        const { wishlistId } = req.params;
        const currentUserId = req.user.id;
        console.log("Current User ID:", currentUserId);

        const wishlistUsers = await WishlistUser.findAll({
            where: { wishlist_id: wishlistId }
        });

        let items = [];

        for (let wishlistUser of wishlistUsers) {
            console.log("WishlistUser's User ID:", wishlistUser.UserId);

            const userItems = await WishlistItem.findAll({
                where: { wishlistUser_id: wishlistUser.id },
                include: [{
                    model: Reservation,
                    include: [User]
                }]
            });

            let transformedItems = userItems.map(item => {
                const plainItem = item.get({ plain: true });

                // Ajoutez l'ID de l'utilisateur à chaque élément
                plainItem.userId = wishlistUser.UserId;

                // Si l'item appartient à l'utilisateur actuellement connecté, supprimez les informations de réservation
                if (wishlistUser.UserId === currentUserId) {
                    console.log("Matched User ID, trying to remove reservations...");

                    // Supprimer le tableau Reservations
                    delete plainItem.Reservations;

                    // Supprimer également les propriétés reserved et reservedBy
                    delete plainItem.reserved;
                    delete plainItem.reservedBy;
                    delete plainItem.bought;
                }

                return plainItem;
            });

            items.push(...transformedItems);

        }

        return res.status(200).json(items);

    } catch (error) {
        console.error('Erreur lors de la récupération des items de la wishlist :', error);
        return res.status(500).json({ message: 'Erreur serveur lors de la récupération des items' });
    }
});

app.delete('/reservation/:itemId', verifyJWT, async (req, res) => {
    try {
        const { itemId } = req.params;

        // Vérifiez si l'item est déjà réservé
        const reservation = await Reservation.findOne(
            { where: { wishlistItem_id: itemId } }
        );

        const wishlistItem = await WishlistItem.findOne(
            { where: { id: itemId } }
        );

        if (!reservation) {
            return res.status(404).send({ message: 'Reservation not found.' });
        } else if  (!reservation.reserved) {
            return res.status(400).send({message: 'Reservation not reserved.'});
        } else {

            await reservation.destroy();

            wishlistItem.reserved = false;
            wishlistItem.reservedBy = null;
            await wishlistItem.save();

            return res.send({ message: 'Deletion successfull.' });
        }
    } catch (error) {
        console.error('Erreur lors de la suppression de la reservation :', error);
        return res.status(500).json({ message: 'Erreur serveur lors de la suppression de la reservation'});
    }
});

// Synchronise le modèle avec la base de données et démarre le serveur
(async () => {
    try {
        //await sequelize.sync({ force: true });
        await sequelize.sync();
        console.log('Database and tables synced.');
        app.listen(PORT, () => {
            console.log(`Server started on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Error syncing database:', error);
    }
})();
